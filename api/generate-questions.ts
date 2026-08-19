import type { VercelRequest, VercelResponse } from "@vercel/node";

// 오늘의 안부 질문을 지병에 맞춰 매일 새롭게, 질문 성격에 맞는 답변 선택지와 함께 생성한다.
// 근거: 실사용 피드백 — "질문이 너무 형식적이고 답변이 맞지 않는다"
// GEMINI_API_KEY가 없거나 호출이 실패하면 고정 문항(네/아니요)으로 조용히 대체한다.
// category/severity는 lib/riskScoring.ts가 위험도를 계산할 때 쓰는 구조화된 신호다 — 근거: 기능설계서.md §3, plan "P0"

type Category = "medication" | "meal" | "outing" | "mood" | "condition" | "other";
type Severity = "ok" | "warn" | "danger";

interface GeneratedOption {
  text: string;
  severity: Severity;
}

interface GeneratedQuestion {
  question: string;
  category: Category;
  options: GeneratedOption[];
}

const CATEGORIES: Category[] = ["medication", "meal", "outing", "mood", "condition", "other"];
const SEVERITIES: Severity[] = ["ok", "warn", "danger"];

const COMMON_FALLBACK: GeneratedQuestion[] = [
  {
    question: "약 드셨어요?",
    category: "medication",
    options: [
      { text: "네, 먹었어요", severity: "ok" },
      { text: "아직이에요", severity: "warn" },
    ],
  },
  {
    question: "식사하셨어요?",
    category: "meal",
    options: [
      { text: "네, 먹었어요", severity: "ok" },
      { text: "아직이에요", severity: "warn" },
    ],
  },
  {
    question: "오늘 밖에 나가셨어요?",
    category: "outing",
    options: [
      { text: "네, 나갔어요", severity: "ok" },
      { text: "아직 안 나갔어요", severity: "warn" },
    ],
  },
];

const CONDITION_FALLBACK: Record<string, GeneratedQuestion> = {
  htn: {
    question: "머리 아프거나 어지럽지 않으세요?",
    category: "condition",
    options: [
      { text: "괜찮아요", severity: "ok" },
      { text: "조금 그래요", severity: "warn" },
      { text: "많이 그래요", severity: "danger" },
    ],
  },
  diabetes: {
    question: "손발이 저리지 않으세요?",
    category: "condition",
    options: [
      { text: "괜찮아요", severity: "ok" },
      { text: "조금 그래요", severity: "warn" },
      { text: "많이 그래요", severity: "danger" },
    ],
  },
  heart: {
    question: "가슴이 답답하거나 두근거리지 않으세요?",
    category: "condition",
    options: [
      { text: "괜찮아요", severity: "ok" },
      { text: "조금 그래요", severity: "warn" },
      { text: "많이 그래요", severity: "danger" },
    ],
  },
  stroke: {
    question: "손발에 힘이 빠지는 느낌 없으세요?",
    category: "condition",
    options: [
      { text: "없어요", severity: "ok" },
      { text: "조금 있어요", severity: "warn" },
      { text: "많이 있어요", severity: "danger" },
    ],
  },
  parkinsons: {
    question: "몸이 떨리거나 움직임이 둔하지 않으세요?",
    category: "condition",
    options: [
      { text: "괜찮아요", severity: "ok" },
      { text: "조금 그래요", severity: "warn" },
      { text: "많이 그래요", severity: "danger" },
    ],
  },
  depression: {
    question: "오늘 기분은 어떠세요?",
    category: "mood",
    options: [
      { text: "좋아요", severity: "ok" },
      { text: "보통이에요", severity: "warn" },
      { text: "안 좋아요", severity: "danger" },
    ],
  },
  arthritis: {
    question: "무릎이 많이 아프지 않으세요?",
    category: "condition",
    options: [
      { text: "괜찮아요", severity: "ok" },
      { text: "조금 아파요", severity: "warn" },
      { text: "많이 아파요", severity: "danger" },
    ],
  },
  copd: {
    question: "숨쉬기 힘들거나 기침이 심하지 않으세요?",
    category: "condition",
    options: [
      { text: "괜찮아요", severity: "ok" },
      { text: "조금 그래요", severity: "warn" },
      { text: "많이 그래요", severity: "danger" },
    ],
  },
};

function fallbackQuestions(conditions: string[]): GeneratedQuestion[] {
  const extra = conditions.map((c) => CONDITION_FALLBACK[c]).filter(Boolean) as GeneratedQuestion[];
  return [...COMMON_FALLBACK, ...extra];
}

function buildPrompt(conditions: string[], recentQuestions: string[]): string {
  return `당신은 독거 어르신에게 매일 안부를 묻는 다정한 도우미입니다.
이 어르신이 앓고 있는 지병: ${conditions.length ? conditions.join(", ") : "없음"}

오늘의 안부 질문을 6~8개 만들어주세요. 규칙:
1. 복약 여부(category="medication"), 식사 여부(category="meal"), 외출 여부(category="outing")는 반드시 각각 1개씩 포함(표현은 매일 다르게).
2. 지병이 있다면 각 지병에 맞는 질문을 최소 1개씩 포함(category="condition", 우울증 관련이면 category="mood").
3. 짧고 다정한 존댓말, 어르신이 부담 없이 답할 수 있는 문장.
4. 질문마다 상황에 맞는 답변 선택지 2~3개를 제공하세요. 모든 질문에 "네/아니요"만 쓰지 말고, 질문 성격에 맞게 다르게 만드세요 (예: 기분을 묻는 질문이면 "좋아요/보통이에요/안 좋아요"처럼).
5. 각 선택지에는 severity를 반드시 붙이세요: 정상/걱정없음="ok", 경미한 우려="warn", 심각한 우려="danger". 각 질문의 선택지 중 최소 하나는 "ok"여야 합니다.
6. category는 반드시 "medication"/"meal"/"outing"/"mood"/"condition"/"other" 중 하나만 쓰세요.
7. 아래는 최근에 이미 사용한 질문입니다. 같은 표현을 반복하지 말고 새롭게 작성하세요: ${recentQuestions.length ? recentQuestions.join(" / ") : "(없음)"}

반드시 아래 JSON 배열 형식으로만, 다른 설명 없이 답하세요:
[{"question": "질문 텍스트", "category": "medication", "options": [{"text": "선택지1", "severity": "ok"}, {"text": "선택지2", "severity": "warn"}]}]`;
}

function isValidOption(item: unknown): item is GeneratedOption {
  return (
    Boolean(item) &&
    typeof item === "object" &&
    typeof (item as GeneratedOption).text === "string" &&
    SEVERITIES.includes((item as GeneratedOption).severity)
  );
}

function normalize(parsed: unknown): GeneratedQuestion[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is GeneratedQuestion => {
      if (!item || typeof item !== "object") return false;
      const q = item as GeneratedQuestion;
      return (
        typeof q.question === "string" &&
        CATEGORIES.includes(q.category) &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.every(isValidOption)
      );
    })
    .slice(0, 8);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const { conditions = [], recentQuestions = [] } = (req.body ?? {}) as {
    conditions?: string[];
    recentQuestions?: string[];
  };

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    res.status(200).json({ questions: fallbackQuestions(conditions), source: "fallback" });
    return;
  }

  try {
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(conditions, recentQuestions) }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const geminiJson = await geminiResp.json();
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const questions = normalize(JSON.parse(text));
    if (questions.length === 0) throw new Error("empty generation result");
    res.status(200).json({ questions, source: "gemini" });
  } catch {
    res.status(200).json({ questions: fallbackQuestions(conditions), source: "fallback" });
  }
}
