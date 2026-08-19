import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function assessRisk(admin: SupabaseClient, elderProfileId: string, date: string): Promise<void> {
  const [{ data: conditions }, { data: checkin }] = await Promise.all([
    admin.from("elder_condition").select("condition_type").eq("elder_profile_id", elderProfileId),
    admin
      .from("daily_checkin")
      .select("id,answers,skipped")
      .eq("elder_profile_id", elderProfileId)
      .eq("date", date)
      .maybeSingle(),
  ]);

  // 오늘 체크인이 아직 없으면(예: 음성만 먼저 저장되는 경우는 없지만 방어적으로) 계산하지 않는다.
  if (!checkin) return;

  const conditionTypes = new Set((conditions ?? []).map((c) => c.condition_type as string));
  const reasons: string[] = [];
  let score = 0;

  if (checkin.skipped) {
    score += 1;
    reasons.push("오늘 안부체크를 건너뛰었습니다");
  }

  const answers = Array.isArray(checkin.answers) ? (checkin.answers as AnsweredQuestion[]) : [];
  for (const a of answers) {
    if (!a || typeof a.severity !== "string") continue;
    let points = SEVERITY_POINTS[a.severity] ?? 0;

    if (a.category === "outing" && conditionTypes.has("arthritis")) {
      // §3: 관절염 보유자는 외출 없음을 위험 요인으로 보지 않는다
      points = 0;
    } else if (a.category === "medication" && conditionTypes.has("htn") && a.severity !== "ok") {
      points *= 1.5;
      if (points > 0) reasons.push("복약을 놓치셨어요(고혈압)");
    } else if (a.category === "meal" && conditionTypes.has("diabetes") && a.severity !== "ok") {
      points *= 2.4;
      if (points > 0) reasons.push("식사를 거르셨어요(당뇨병 저혈당 위험)");
    } else if (points > 0) {
      reasons.push(`"${a.question}" 응답이 평소와 다릅니다`);
    }
    score += points;
  }

  const { data: voice } = await admin
    .from("voice_response")
    .select("analysis_status")
    .eq("daily_checkin_id", checkin.id)
    .maybeSingle();

  if (voice?.analysis_status === "failed") {
    score += 1;
    reasons.push("음성 분석에 실패해 확인이 필요합니다");
  }

  const level = score >= LEVEL_THRESHOLD.심각 ? "심각" : score >= LEVEL_THRESHOLD.위험 ? "위험" : "안전";
  const reason = reasons.length ? reasons.join(" / ") : "특별한 위험 신호가 없습니다";

  await admin.from("risk_assessment").upsert(
    {
      elder_profile_id: elderProfileId,
      date,
      level,
      reason,
      triggered_by: { score, categories: answers.map((a) => a.category) },
    },
    { onConflict: "elder_profile_id,date" }
  );

  await admin.from("elder_profile").update({ priority_status: level }).eq("id", elderProfileId);
}
