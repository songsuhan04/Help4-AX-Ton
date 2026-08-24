import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// 기능설계서.md §3/§6 오픈 이슈 — "안부 시각으로부터 7시간 넘게 무응답이면 위험 신호로 본다".
// 근거: Help4/발표 자료/위험도가중치 근거자료.docx 및 팀 논의.
// 다른 위험도 계산(lib/riskScoring.ts)은 어르신이 뭔가 했을 때(안부체크 완료, 음성분석 완료)만
// 재계산되는데, "아무것도 안 했다"는 부재는 트리거할 사용자 행동이 없다. 그래서 이 엔드포인트만
// 유일하게 스스로 주기적으로 확인하는 배치(Vercel Cron)로 만들었다.
// ⚠️ Vercel Hobby 플랜은 크론을 하루 1번만 돌릴 수 있어 정확히 7시간째를 못 잡고, 하루 한 번
// (21:00 KST) 몰아서 확인한다 — 기본 안부 시각(08:00) 기준으로는 충분히 늦은 시간이라 대부분
// 놓치지 않지만, 안부 시각을 늦은 오후로 설정한 경우엔 하루 늦게 잡힐 수 있다.
const NO_RESPONSE_ALERT_HOURS = 7;

function seoulNow(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(200).json({ status: "skipped", reason: "supabase not configured" });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const now = seoulNow();
  const today = now.toISOString().slice(0, 10);

  const { data: elders, error } = await admin.from("elder_profile").select("id,checkin_time");
  if (error) {
    res.status(500).json({ status: "failed", error: error.message });
    return;
  }

  let flagged = 0;
  for (const elder of elders ?? []) {
    const { data: checkin } = await admin
      .from("daily_checkin")
      .select("id")
      .eq("elder_profile_id", elder.id)
      .eq("date", today)
      .maybeSingle();
    if (checkin) continue; // 이미 응답함 — 대상 아님

    const [h, m] = (elder.checkin_time as string).slice(0, 5).split(":").map(Number);
    const deadline = new Date(now);
    deadline.setHours(h, m, 0, 0);
    deadline.setHours(deadline.getHours() + NO_RESPONSE_ALERT_HOURS);
    if (now < deadline) continue; // 아직 7시간 안 지남

    const { data: existing } = await admin
      .from("risk_assessment")
      .select("level")
      .eq("elder_profile_id", elder.id)
      .eq("date", today)
      .maybeSingle();
    if (existing?.level === "심각") continue; // 이미 더 심각한 판정이 있으면 낮추지 않음

    await admin.from("risk_assessment").upsert(
      {
        elder_profile_id: elder.id,
        date: today,
        level: "위험",
        reason: `안부 시각(${elder.checkin_time.slice(0, 5)})으로부터 ${NO_RESPONSE_ALERT_HOURS}시간 넘게 응답이 없어요. 확인이 필요합니다`,
        triggered_by: { no_response_hours: NO_RESPONSE_ALERT_HOURS },
      },
      { onConflict: "elder_profile_id,date" }
    );
    await admin.from("elder_profile").update({ priority_status: "위험" }).eq("id", elder.id);
    flagged++;
  }

  res.status(200).json({ status: "ok", checked: elders?.length ?? 0, flagged });
}
