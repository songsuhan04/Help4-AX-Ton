import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushForElder } from "./sendPush";

// 위험도 실제 산정 로직 — docs/기능설계서.md §3의 잠정 규칙을 점수화한 것.
// demo/v1/src/config/riskConstants.ts에도 동일한 값을 문서용으로 미러링해두었다(수동 동기화).
type Severity = "ok" | "warn" | "danger";
type Category = "medication" | "meal" | "outing" | "mood" | "condition" | "other";

interface AnsweredQuestion {
  question: string;
  category: Category;
  choice: string;
  severity: Severity;
}

const SEVERITY_POINTS: Record<Severity, number> = { ok: 0, warn: 1, danger: 2 };
const LEVEL_THRESHOLD = { 심각: 3, 위험: 1 } as const;
const NO_OUTING_ALERT_DAYS = 3;

// date 포함, 그 이전으로 n일치 날짜 문자열을 최신순으로 반환. 이미 yyyy-mm-dd 형식의
// 서비스 날짜(한국 시간 기준)를 받아 달력 날짜만 빼는 연산이라, 정오 기준으로 계산해
// 타임존/DST 경계에서 하루가 밀리지 않게 한다.
function lastNDates(dateStr: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${dateStr}T12:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

export async function assessRisk(admin: SupabaseClient, elderProfileId: string, date: string): Promise<void> {
  const [{ data: conditions, error: condErr }, { data: checkin, error: checkinErr }] = await Promise.all([
    admin.from("elder_condition").select("condition_type").eq("elder_profile_id", elderProfileId),
    admin
      .from("daily_checkin")
      .select("id,answers,skipped")
      .eq("elder_profile_id", elderProfileId)
      .eq("date", date)
      .maybeSingle(),
  ]);
  if (condErr) console.error("assessRisk: elder_condition query failed", condErr);
  if (checkinErr) console.error("assessRisk: daily_checkin query failed", checkinErr);

  // 오늘 체크인이 아직 없으면(예: 음성만 먼저 저장되는 경우는 없지만 방어적으로) 계산하지 않는다.
  if (!checkin) return;

  const conditionTypes = new Set((conditions ?? []).map((c) => c.condition_type as string));
  const reasons: string[] = [];
  let score = 0;

  if (checkin.skipped) {
    score += 1;
    reasons.push("오늘 안부체크를 건너뛰셨어요. 확인이 필요합니다");
  }

  const answers = Array.isArray(checkin.answers) ? (checkin.answers as AnsweredQuestion[]) : [];
  for (const a of answers) {
    if (!a || typeof a.severity !== "string") continue;
    let points = SEVERITY_POINTS[a.severity] ?? 0;

    if (a.category === "outing" && conditionTypes.has("arthritis")) {
      // §3: 관절염 보유자는 외출 없음을 위험 요인으로 보지 않는다
      points = 0;
    } else if (a.category === "medication" && conditionTypes.has("htn") && a.severity !== "ok") {
      // ×1.5 — Help4/발표 자료/위험도가중치 근거자료.docx §4.1에서 검증 통과(근거등급 A).
      // 61개 코호트 IPD 100만명 기준 보고된 효과크기 범위(HR/OR 1.36~2.11)의 보수적 하위-중앙값.
      points *= 1.5;
      // "놓치셨어요"처럼 확정적으로 단정하지 않고, 어르신이 실제로 고른 답변을 그대로
      // 보여주며 "확인이 필요합니다"로 끝맺는다 — 보호자가 무엇을 봐야 하는지 바로 알 수 있게.
      // 근거: 실사용 피드백 — "어떤 점을 확인해봐야 하는지로 나오는 게 더 나을 것 같다"
      if (points > 0) reasons.push(`복약 질문에 "${a.choice}"라고 답하셨어요. 확인이 필요합니다`);
    } else if (a.category === "meal" && conditionTypes.has("diabetes") && a.severity !== "ok") {
      // ×2.0 — 위와 같은 문서 §4.2 권고값(근거등급 A: INTERHEART OR 2.37, IPD 메타분석 HR 1.44).
      // 문서는 "당뇨 가중치가 고혈압보다 높아야 상대 서열이 문헌과 일치한다"고 명시 — 기존 ×2.4(임의값)에서 조정.
      points *= 2.0;
      if (points > 0) reasons.push(`식사 질문에 "${a.choice}"라고 답하셨어요. 확인이 필요합니다`);
    } else if (points > 0) {
      reasons.push(`"${a.question}"에 "${a.choice}"라고 답하셨어요. 확인이 필요합니다`);
    }
    score += points;
  }

  const { data: voice, error: voiceErr } = await admin
    .from("voice_response")
    .select("analysis_status")
    .eq("daily_checkin_id", checkin.id)
    .maybeSingle();
  if (voiceErr) console.error("assessRisk: voice_response query failed", voiceErr);

  if (voice?.analysis_status === "failed") {
    score += 1;
    reasons.push("음성 분석에 실패해 확인이 필요합니다");
  }

  // 외출 연속 없음 — 오늘 하루만 보면 위험 신호가 아니어도 며칠 연속되면 그 자체가 위험 신호다.
  // 관절염 보유자는 단일 답변과 마찬가지로 외출 여부를 위험 요인으로 보지 않으므로 이 검사도 제외한다.
  if (!conditionTypes.has("arthritis")) {
    const { data: recentCheckins, error: recentErr } = await admin
      .from("daily_checkin")
      .select("date,answers")
      .eq("elder_profile_id", elderProfileId)
      .lte("date", date)
      .order("date", { ascending: false })
      .limit(NO_OUTING_ALERT_DAYS);
    if (recentErr) console.error("assessRisk: recent daily_checkin query failed", recentErr);

    const rows = recentCheckins ?? [];
    const expectedDates = lastNDates(date, NO_OUTING_ALERT_DAYS);
    const isConsecutive = rows.length === NO_OUTING_ALERT_DAYS && rows.every((row, i) => row.date === expectedDates[i]);
    const allNoOuting =
      isConsecutive &&
      rows.every((row) => {
        const dayAnswers = Array.isArray(row.answers) ? (row.answers as AnsweredQuestion[]) : [];
        const outing = dayAnswers.find((a) => a?.category === "outing");
        return outing && outing.severity !== "ok";
      });
    if (allNoOuting) {
      score += 1;
      reasons.push(`최근 ${NO_OUTING_ALERT_DAYS}일 연속 외출을 안 하셨어요. 확인이 필요합니다`);
    }
  }

  const level = score >= LEVEL_THRESHOLD.심각 ? "심각" : score >= LEVEL_THRESHOLD.위험 ? "위험" : "안전";
  const reason = reasons.length ? reasons.join(" / ") : "특별한 위험 신호가 없습니다";

  // 알림 중복 방지 — assessRisk는 안부 완료 시점과 음성 분석 완료 시점 두 번 실행되므로
  // 직전 등급을 먼저 읽어두고, 등급이 실제로 나빠졌을 때만 푸시를 보낸다.
  const { data: before } = await admin
    .from("risk_assessment")
    .select("level")
    .eq("elder_profile_id", elderProfileId)
    .eq("date", date)
    .maybeSingle();
  const previousLevel = (before?.level as string | undefined) ?? null;

  const { error: upsertErr } = await admin.from("risk_assessment").upsert(
    {
      elder_profile_id: elderProfileId,
      date,
      level,
      reason,
      triggered_by: { score, categories: answers.map((a) => a.category) },
    },
    { onConflict: "elder_profile_id,date" }
  );
  if (upsertErr) console.error("assessRisk: risk_assessment upsert failed", upsertErr);

  const { error: updateErr } = await admin
    .from("elder_profile")
    .update({ priority_status: level })
    .eq("id", elderProfileId);
  if (updateErr) console.error("assessRisk: elder_profile update failed", updateErr);

  // 위험/심각으로 새로 올라갔을 때만 보호자에게 알린다. 같은 등급이 유지되는 동안은
  // 다시 보내지 않아 하루에 같은 알림이 반복되지 않는다.
  const worsened = level !== "안전" && level !== previousLevel;
  if (worsened) {
    const { data: elder } = await admin
      .from("elder_profile")
      .select("name")
      .eq("id", elderProfileId)
      .maybeSingle();
    const name = (elder?.name as string | undefined) ?? "어르신";
    await sendPushForElder(admin, elderProfileId, {
      title: `${name}님 — 확인이 필요합니다`,
      body: reason,
      url: `/guardian/elders/${elderProfileId}`,
      tag: `risk-${elderProfileId}-${date}`,
    });
  }
}
