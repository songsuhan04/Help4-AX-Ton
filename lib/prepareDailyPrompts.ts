import type { SupabaseClient } from "@supabase/supabase-js";
import { generateQuestions, type GeneratedQuestion } from "./dailyQuestions";
import { generateTopics } from "./dailyTopic";

// 그날 쓸 안부 질문과 녹음 주제를 새벽에 미리 만들어 daily_prompt에 넣는다.
//
// 왜 미리 만드는가: 예전에는 어르신이 안부 화면을 열 때 Gemini를 호출했다. 그러면 그날 첫
// 사용자는 생성이 끝날 때까지 기다려야 하고, 서버리스 콜드 스타트까지 겹친다. 하필 가장
// 덜 익숙한 분이 쓰는 화면이다. 근거: 실사용 피드백 — "버퍼링이 걸리더라"
//
// 미리 만들면 화면은 표 한 줄만 읽으므로 기다림이 없고, AI가 실패해도 새벽에 조용히
// 고정 문항으로 대체되어 어르신은 알지 못한다. 시간 여유가 있으니 최근 답변까지 넣어
// 개인화도 더 세게 할 수 있다.

// 한 번 실행에서 처리할 최대 어르신 수 — 크론 실행 시간이 무한정 늘어나지 않게 하는 안전장치
const MAX_ELDERS_PER_RUN = 200;
// 개인화에 참고할 최근 안부 답변 수
const RECENT_ANSWER_LIMIT = 8;
// 지난 주제를 며칠치까지 남겨둘지. 주제 반복을 피하려면 최근 며칠만 알면 되고, 그 이상은
// 하루하루 쌓이기만 한다(어르신 1명당 매일 1행). 영상편지에 7일 보관을 둔 것과 같은 이유로
// 여기도 상한을 둔다 — 지병·안부 답변에서 뽑아낸 문장이라 오래 들고 있을 이유가 없다.
const PROMPT_RETENTION_DAYS = 14;

// 어르신을 한 명씩 차례로 처리했더니 함수 실행 시간을 넘겨 도중에 끊겼다. 실제로 8/29
// 새벽 실행은 9명 중 4명만 만들고 멈췄다(어르신당 15~20초 × 9명). 몇 명씩 동시에 처리한다.
// Gemini 호출이 대부분의 시간이라 동시성이 그대로 시간 단축이 된다.
const CONCURRENCY = 6;

// Vercel Hobby 플랜의 함수 실행 상한이 60초라, 그 전에 스스로 멈추고 지금까지 만든 것을
// 저장한 채 끝낸다. 중간에 강제로 잘리면 무엇까지 했는지 알 수 없다.
// 못 만든 어르신은 화면에서 예전 방식(즉석 생성)으로 떨어지므로 안부 자체는 막히지 않는다.
//
// 남은 시간만 보고 다음 묶음을 시작하면, 그 묶음이 예상보다 오래 걸릴 때 상한에 걸린다.
// 그래서 직전 묶음이 실제로 걸린 시간을 재서 "이번 묶음도 그만큼 걸린다면 상한을 넘는가"로
// 판단한다. Gemini 응답이 느린 날에도 스스로 멈출 수 있다.
const SAFE_LIMIT_MS = 55_000;
// 첫 묶음은 실측치가 없으므로 이 값으로 가정한다(관측된 어르신당 15~20초 기준)
const ASSUMED_WAVE_MS = 20_000;
// 느려질 여지를 두고 직전 실측치에 곱한다
const WAVE_SLACK = 1.3;

export interface PrepareResult {
  prepared: number;
  skipped: number;
  gemini: number;
  fallback: number;
  pruned: number;
  // 시간이 모자라 손대지 못한 어르신 수 — 0이 아니면 동시성이나 예산을 손봐야 한다는 신호
  remaining: number;
}

/**
 * @param date 준비할 날짜(YYYY-MM-DD, 한국 날짜). 이미 그 날짜 행이 있으면 건드리지 않는다.
 */
export async function prepareDailyPrompts(
  admin: SupabaseClient,
  date: string,
  geminiKey: string | undefined
): Promise<PrepareResult> {
  const startedAt = Date.now();
  const result: PrepareResult = { prepared: 0, skipped: 0, gemini: 0, fallback: 0, pruned: 0, remaining: 0 };

  // 오래된 주제를 먼저 지운다. 실패해도 생성은 계속한다 — 정리 못 한 것이 오늘 안부를
  // 막을 이유는 없다.
  const cutoff = new Date(Date.parse(`${date}T00:00:00Z`) - PROMPT_RETENTION_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: pruned, error: pruneError } = await admin
    .from("daily_prompt")
    .delete()
    .lt("date", cutoff)
    .select("date");
  if (pruneError) console.error("prepareDailyPrompts: prune failed", pruneError.message);
  else result.pruned = pruned?.length ?? 0;

  const { data: elders, error } = await admin
    .from("elder_profile")
    .select("id")
    .limit(MAX_ELDERS_PER_RUN);
  if (error) {
    console.error("prepareDailyPrompts: elder list failed", error.message);
    return result;
  }

  // 이미 준비된 어르신은 다시 만들지 않는다 — 크론이 두 번 돌아도 주제가 바뀌면 안 된다
  const { data: existing } = await admin
    .from("daily_prompt")
    .select("elder_profile_id")
    .eq("date", date);
  const done = new Set((existing ?? []).map((r) => r.elder_profile_id as string));

  // 한 어르신 몫. 실패해도 다른 어르신 처리를 막지 않도록 예외를 안에서 삼킨다.
  async function prepareOne(elderId: string): Promise<void> {
    const [{ data: conditionRows }, { data: recentRows }] = await Promise.all([
      admin.from("elder_condition").select("condition_type").eq("elder_profile_id", elderId),
      admin
        .from("daily_checkin")
        .select("questions,answers")
        .eq("elder_profile_id", elderId)
        .order("date", { ascending: false })
        .limit(3),
    ]);

    const conditions = (conditionRows ?? []).map((r) => r.condition_type as string);
    const recentQuestions = (recentRows ?? [])
      .flatMap((r) => ((r.questions as GeneratedQuestion[]) ?? []).map((q) => q.question))
      .slice(0, 12);
    // 최근에 어떤 답을 했는지까지 넣어 "어제 이러셨는데 오늘은 어떠세요" 같은 주제가 나오게 한다
    const recentAnswers = (recentRows ?? [])
      .flatMap((r) => ((r.answers as { question?: string; choice?: string }[]) ?? []))
      .filter((a) => a?.question && a?.choice)
      .map((a) => `${a.question} → ${a.choice}`)
      .slice(0, RECENT_ANSWER_LIMIT);

    const { data: recentTopicRows } = await admin
      .from("daily_prompt")
      .select("speech_topic,letter_topic")
      .eq("elder_profile_id", elderId)
      .order("date", { ascending: false })
      .limit(7);
    const recentTopics = (recentTopicRows ?? [])
      .flatMap((r) => [r.speech_topic as string | null, r.letter_topic as string | null])
      .filter((t): t is string => Boolean(t));

    const [questionResult, topicResult] = await Promise.all([
      generateQuestions(geminiKey, conditions, recentQuestions),
      generateTopics(geminiKey, { conditions, recentAnswers, recentTopics }),
    ]);

    const { error: upsertError } = await admin.from("daily_prompt").upsert(
      {
        elder_profile_id: elderId,
        date,
        questions: questionResult.questions,
        // 검증에 걸린 주제는 null로 남긴다 — 화면이 고정 목록으로 떨어진다
        speech_topic: topicResult.speechTopic,
        letter_topic: topicResult.letterTopic,
        // 왜 버려졌는지 남긴다 — 로그는 한 시간이면 사라진다
        notes: Object.keys(topicResult.notes).length > 0 ? topicResult.notes : null,
        source: questionResult.source === "gemini" || topicResult.source === "gemini" ? "gemini" : "fallback",
      },
      { onConflict: "elder_profile_id,date" }
    );
    if (upsertError) {
      console.error("prepareDailyPrompts: upsert failed", elderId, upsertError.message);
      return;
    }

    result.prepared++;
    if (questionResult.source === "gemini") result.gemini++;
    else result.fallback++;
  }

  const pending = (elders ?? []).map((e) => e.id as string).filter((id) => {
    if (done.has(id)) {
      result.skipped++;
      return false;
    }
    return true;
  });

  // CONCURRENCY 명씩 묶어 처리한다. 다음 묶음을 시작하기 전에, 직전 묶음이 걸린 만큼
  // 또 걸린다고 보고 상한을 넘길 것 같으면 멈춘다.
  let index = 0;
  let lastWaveMs = ASSUMED_WAVE_MS;
  while (index < pending.length) {
    const elapsed = Date.now() - startedAt;
    if (elapsed + lastWaveMs * WAVE_SLACK > SAFE_LIMIT_MS) {
      result.remaining = pending.length - index;
      console.error(
        `prepareDailyPrompts: stopping early, ${result.remaining} elder(s) left ` +
          `(elapsed ${elapsed}ms, last wave ${lastWaveMs}ms)`
      );
      break;
    }
    const waveStartedAt = Date.now();
    const batch = pending.slice(index, index + CONCURRENCY);
    await Promise.all(
      batch.map((id) =>
        prepareOne(id).catch((err) => {
          console.error("prepareDailyPrompts: elder failed", id, err instanceof Error ? err.message : err);
        })
      )
    );
    lastWaveMs = Date.now() - waveStartedAt;
    index += batch.length;
  }

  return result;
}
