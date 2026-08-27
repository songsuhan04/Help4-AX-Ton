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

export interface PrepareResult {
  prepared: number;
  skipped: number;
  gemini: number;
  fallback: number;
}

/**
 * @param date 준비할 날짜(YYYY-MM-DD, 한국 날짜). 이미 그 날짜 행이 있으면 건드리지 않는다.
 */
export async function prepareDailyPrompts(
  admin: SupabaseClient,
  date: string,
  geminiKey: string | undefined
): Promise<PrepareResult> {
  const result: PrepareResult = { prepared: 0, skipped: 0, gemini: 0, fallback: 0 };

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

  for (const elder of elders ?? []) {
    const elderId = elder.id as string;
    if (done.has(elderId)) {
      result.skipped++;
      continue;
    }

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
        source: questionResult.source === "gemini" || topicResult.source === "gemini" ? "gemini" : "fallback",
      },
      { onConflict: "elder_profile_id,date" }
    );
    if (upsertError) {
      console.error("prepareDailyPrompts: upsert failed", elderId, upsertError.message);
      continue;
    }

    result.prepared++;
    if (questionResult.source === "gemini") result.gemini++;
    else result.fallback++;
  }

  return result;
}
