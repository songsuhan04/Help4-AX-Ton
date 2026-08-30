import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prepareDailyPrompts } from "../lib/prepareDailyPrompts";
import { todaySeoul } from "../lib/seoulDate";
import { RETENTION } from "../lib/retention";

// 매일 새벽(18:00 UTC = 03:00 KST) 도는 크론. 두 가지 일을 한다.
//
// 1. 영상편지 정리 — 계속 쌓이면 스토리지가 무한정 늘어나므로 일정 기간이 지나면 지운다.
//    근거: 실사용 피드백 — "1주일치만 저장되고 지나면 자동 삭제되게 하자"
// 2. 오늘 쓸 안부 질문·녹음 주제 미리 만들기 — 어르신이 화면을 열 때 AI를 호출하면 그날 첫
//    사용자가 기다려야 한다. 근거: 실사용 피드백 — "버퍼링이 걸리더라"
//
// 두 일이 성격은 다르지만 크론을 나누지 않았다. Vercel Hobby 플랜은 크론 개수와 실행 횟수가
// 제한되고, 마침 이 크론이 도는 새벽 3시가 그날 것을 미리 만들기에 딱 맞는 시각이다.
// Vercel Hobby 플랜에서 함수가 돌 수 있는 최대 시간. 명시하지 않으면 더 짧은 기본값으로
// 잘려서, 어르신 수가 늘면 주제를 다 만들지 못한 채 끊긴다(실제로 9명 중 4명에서 끊겼다).
export const config = { maxDuration: 60 };

const RETENTION_DAYS = RETENTION.LETTER_DAYS;
// 한 번 실행에서 처리할 최대 건수 — 크론이 오래 밀렸다가 재개되는 경우를 대비한 안전장치
const MAX_PER_RUN = 500;

/**
 * 주인이 사라진 스토리지 파일을 청소한다.
 *
 * 스토리지 파일은 DB의 cascade로 지워지지 않아, 어르신을 삭제하면 음성·영상 파일만
 * 남는다(실제로 삭제된 어르신의 녹음 파일이 남아 있는 것을 확인했다). 약관에 "보유 기간:
 * 어르신 등록 해제 시까지"라고 써놓은 것과 어긋나므로 주기적으로 쓸어낸다.
 * 파일 경로 규칙이 <elder_profile_id>/<날짜>/<uuid> 라서 최상위 폴더 이름을 어르신 id로 보고
 * 대조하면 된다.
 */
async function sweepOrphanFiles(admin: SupabaseClient): Promise<number> {
  const { data: elders } = await admin.from("elder_profile").select("id");
  const alive = new Set((elders ?? []).map((e) => e.id as string));

  let removed = 0;
  for (const bucket of ["voice", "letters"] as const) {
    const { data: topDirs } = await admin.storage.from(bucket).list("", { limit: 1000 });
    for (const dir of topDirs ?? []) {
      if (alive.has(dir.name)) continue; // 아직 있는 어르신 — 건드리지 않는다
      const paths: string[] = [];
      const { data: dateDirs } = await admin.storage.from(bucket).list(dir.name, { limit: 1000 });
      for (const d of dateDirs ?? []) {
        const { data: files } = await admin.storage.from(bucket).list(`${dir.name}/${d.name}`, { limit: 1000 });
        for (const f of files ?? []) paths.push(`${dir.name}/${d.name}/${f.name}`);
      }
      if (paths.length === 0) continue;
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) console.error("sweepOrphanFiles: remove failed", bucket, error.message);
      else removed += paths.length;
    }
  }
  return removed;
}

/**
 * 보관 기간이 지난 음성 파일을 지운다. 행은 남기고 audio_url만 비운다.
 *
 * 받아쓴 내용·소견은 텍스트라 아주 작고 위험도 판단에 쓰인다. 무거운 것은 오디오뿐이므로
 * 파일만 떼어낸다. 어르신의 목소리 원본을 필요 이상으로 들고 있지 않는다는 뜻이기도 하다.
 */
async function sweepOldVoiceFiles(admin: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION.VOICE_AUDIO_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await admin
    .from("voice_response")
    .select("id,audio_url")
    .lt("created_at", cutoff)
    .not("audio_url", "is", null)
    .limit(MAX_PER_RUN);
  if (error) {
    console.error("sweepOldVoiceFiles: query failed", error.message);
    return 0;
  }

  let cleared = 0;
  for (const row of rows ?? []) {
    const { error: rmError } = await admin.storage.from("voice").remove([row.audio_url as string]);
    // 파일이 이미 없을 수도 있다(수동 삭제 등). 그 경우에도 audio_url은 비워야 화면이
    // 없는 파일을 계속 불러오려 하지 않는다.
    if (rmError) console.error("sweepOldVoiceFiles: remove failed", row.audio_url, rmError.message);
    const { error: updError } = await admin
      .from("voice_response")
      .update({ audio_url: null })
      .eq("id", row.id);
    if (!updError) cleared++;
  }
  return cleared;
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

  // 삭제된 어르신이 남긴 파일도 함께 정리한다
  const orphansRemoved = await sweepOrphanFiles(admin);
  // 보관 기간이 지난 음성 파일 — 예전에는 상한이 없어 계속 쌓였다
  const voiceCleared = await sweepOldVoiceFiles(admin);

  // 오늘 쓸 질문·주제를 미리 만들어둔다. 실패해도 정리 작업 결과는 그대로 돌려준다 —
  // 미리 만들지 못하면 화면이 예전처럼 즉석 생성/고정 목록으로 떨어지므로 서비스는 멈추지 않는다.
  let prompts = null;
  try {
    prompts = await prepareDailyPrompts(admin, todaySeoul(), process.env.GEMINI_API_KEY);
  } catch (err) {
    console.error("cleanup-old-letters: prepareDailyPrompts failed", err instanceof Error ? err.message : err);
  }

  res.status(200).json({ status: "ok", checked: rows?.length ?? 0, deleted, orphansRemoved, voiceCleared, prompts });
}
