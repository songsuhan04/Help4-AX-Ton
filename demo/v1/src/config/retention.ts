// 보관 기간 — 서버(lib/retention.ts)와 같은 값이어야 한다.
// 화면에 적는 기간과 실제로 지우는 기간이 다르면 약관과 다른 동작이 된다.
export const RETENTION = {
  LETTER_DAYS: 7,
  VOICE_AUDIO_DAYS: 30,
  PROMPT_DAYS: 14,
} as const;
