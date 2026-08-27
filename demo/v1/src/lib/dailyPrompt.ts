import { getSupabase } from "./supabase";

// 새벽 크론이 미리 만들어둔 그날의 질문·주제를 읽는다(api/cleanup-old-letters.ts → lib/prepareDailyPrompts.ts).
//
// 예전에는 화면을 열 때 Gemini를 호출해서 그날 첫 사용자가 기다려야 했다.
// 근거: 실사용 피드백 — "버퍼링이 걸리더라"
//
// 미리 만들어둔 것이 없을 수도 있다(크론 뒤에 등록된 어르신, 크론 실패). 그 경우 null을
// 돌려주고, 부르는 쪽이 예전 방식이나 고정 목록으로 떨어진다.

export interface DailyPrompt {
  questions: unknown[] | null;
  speechTopic: string | null;
  letterTopic: string | null;
}

export async function fetchDailyPrompt(elderProfileId: string, date: string): Promise<DailyPrompt | null> {
  const { data, error } = await getSupabase()
    .from("daily_prompt")
    .select("questions,speech_topic,letter_topic")
    .eq("elder_profile_id", elderProfileId)
    .eq("date", date)
    .maybeSingle();
  if (error || !data) return null;
  return {
    questions: (data.questions as unknown[] | null) ?? null,
    speechTopic: (data.speech_topic as string | null) ?? null,
    letterTopic: (data.letter_topic as string | null) ?? null,
  };
}

// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { getStoredElderProfileId } from "./elderSession";
import { todaySeoul } from "./date";
import { pickDailyTopic } from "./topics";

/**
 * 그날의 주제를 준다. 고정 목록에서 고른 주제로 바로 시작하고, 새벽에 미리 만들어둔 AI
 * 주제가 있으면 그것으로 바꾼다.
 *
 * 처음부터 AI 주제를 기다리지 않는 이유: 기다리는 동안 화면이 비면 어르신은 무엇을 해야
 * 할지 모른다. 미리 만들어둔 것을 읽는 것은 기본키 조회 한 번이라 보통 눈에 띄지 않게
 * 끝나고, 느리거나 끊겨도 화면은 이미 쓸 수 있는 상태다.
 */
export function useDailyTopic(kind: "speech" | "letter", fallbackTopics: string[]): string {
  const [topic, setTopic] = useState(() => pickDailyTopic(fallbackTopics, todaySeoul()));

  useEffect(() => {
    const elderId = getStoredElderProfileId();
    if (!elderId) return;
    let alive = true;
    fetchDailyPrompt(elderId, todaySeoul()).then((prepared) => {
      if (!alive || !prepared) return;
      const next = kind === "speech" ? prepared.speechTopic : prepared.letterTopic;
      // 검증에 걸려 null로 저장된 경우가 있다 — 그때는 고정 목록 주제를 그대로 둔다
      if (next) setTopic(next);
    });
    return () => {
      alive = false;
    };
  }, [kind]);

  return topic;
}
