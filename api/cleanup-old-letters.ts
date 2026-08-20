import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// 영상편지가 계속 쌓이면 스토리지 용량이 무한정 늘어나므로 일정 기간이 지난 영상은
// 자동으로 정리한다. 근거: 실사용 피드백 — "1주일치만 저장되고 지나면 자동 삭제되게 하자"
// Vercel Cron이 매일 이 엔드포인트를 호출한다(vercel.json의 crons 설정 참고).
const RETENTION_DAYS = 7;
// 한 번 실행에서 처리할 최대 건수 — 크론이 오래 밀렸다가 재개되는 경우를 대비한 안전장치
const MAX_PER_RUN = 500;

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
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("video_letter")
    .select("id,video_url")
    .lt("sent_at", cutoff)
    .limit(MAX_PER_RUN);
  if (error) {
    res.status(500).json({ status: "failed", error: error.message });
    return;
  }

  let deleted = 0;
  for (const row of rows ?? []) {
    await admin.storage.from("letters").remove([row.video_url]).catch(() => {});
    const { error: delErr } = await admin.from("video_letter").delete().eq("id", row.id);
    if (!delErr) deleted++;
  }

  res.status(200).json({ status: "ok", checked: rows?.length ?? 0, deleted });
}
