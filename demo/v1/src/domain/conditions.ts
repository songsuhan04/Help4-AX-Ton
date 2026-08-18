// 지병 카테고리 및 지병별 맞춤 질문/위험 가중치 정의
// 근거: docs/기능설계서.md §3 위험도 판정 로직 (수치는 잠정값 — 임상 근거 없음)

export type ConditionCategory = "순환·대사" | "뇌·신경" | "근골격" | "호흡·감각";

export interface ConditionDef {
  id: string;
  label: string;
  category: ConditionCategory;
  question?: string;
  riskNote?: string;
}

export const CONDITIONS: ConditionDef[] = [
  { id: "htn", label: "고혈압", category: "순환·대사", question: "머리 아프거나 어지럽지 않으세요?", riskNote: "약을 놓친 날의 위험을 1.5배로 봅니다" },
  { id: "diabetes", label: "당뇨병", category: "순환·대사", question: "손발이 저리지 않으세요?", riskNote: "식사를 거른 날의 위험을 2.4배로 봅니다 (저혈당)" },
  { id: "hyperlipidemia", label: "고지혈증", category: "순환·대사" },
  { id: "heart", label: "심장질환", category: "순환·대사", question: "가슴이 답답하거나 두근거리지 않으세요?" },
  { id: "stroke", label: "뇌졸중 병력", category: "뇌·신경", question: "손발에 힘이 빠지는 느낌 없으세요?" },
  { id: "dementia", label: "치매·인지저하", category: "뇌·신경" },
  { id: "parkinsons", label: "파킨슨병", category: "뇌·신경", question: "몸이 떨리거나 움직임이 둔하지 않으세요?" },
  { id: "depression", label: "우울증", category: "뇌·신경", question: "오늘 기분은 어떠세요?" },
  { id: "arthritis", label: "관절염", category: "근골격", question: "무릎이 많이 아프지 않으세요?", riskNote: "외출이 적은 것을 위험으로 보지 않습니다" },
  { id: "osteoporosis", label: "골다공증", category: "근골격" },
  { id: "copd", label: "만성폐질환·천식", category: "호흡·감각", question: "숨쉬기 힘들거나 기침이 심하지 않으세요?" },
  { id: "ckd", label: "만성신장질환", category: "호흡·감각" },
  { id: "eye", label: "백내장·녹내장", category: "호흡·감각" },
  { id: "hearing", label: "난청", category: "호흡·감각" },
];

export const CONDITION_CATEGORIES: ConditionCategory[] = ["순환·대사", "뇌·신경", "근골격", "호흡·감각"];

export const COMMON_QUESTIONS = ["약 드셨어요?", "식사하셨어요?", "오늘 밖에 나가셨어요?"];

// 오늘의 안부 문항 세트를 구성한다: 공통 3문항 + 선택된 지병별 문항(최대 3개) = 6~8문항
export function buildDailyQuestions(conditionIds: string[]): string[] {
  const conditionQuestions = CONDITIONS.filter((c) => conditionIds.includes(c.id) && c.question).map((c) => c.question as string);
  return [...COMMON_QUESTIONS, ...conditionQuestions];
}

export function getConditionsByCategory(category: ConditionCategory): ConditionDef[] {
  return CONDITIONS.filter((c) => c.category === category);
}
