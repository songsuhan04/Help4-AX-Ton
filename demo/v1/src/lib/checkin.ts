// "그날 안부에 실제로 응답했는가"를 판단하는 한 가지 기준.
//
// 예전에는 daily_checkin에 그날 행이 있으면 응답한 것으로 봤다. 그런데 행은 어르신이
// 아무것도 답하지 않아도 생길 수 있었고(질문을 미리 저장하던 코드), 그러면
//   - 보호자 목록에 "오늘 완료"로 뜨고
//   - 위험도가 "안전"으로 기록되고
//   - 무응답 7시간 알림이 "이미 응답함"으로 걸러졌다
// 어르신이 하루 종일 아무 말이 없어도 모든 신호가 괜찮다고 말하는 상태가 된다.
// 행의 존재가 아니라 답변의 존재로 판단한다.
//
// 서버에도 같은 판단이 필요하다(lib/riskScoring.ts, api/check-no-response.ts) —
// 그쪽은 의존성을 공유하지 않아 같은 규칙을 각자 담고 있다.
export function hasAnswers(row: { answers?: unknown } | null | undefined): boolean {
  return Array.isArray(row?.answers) && row.answers.length > 0;
}

/** 건너뛰기도 "어르신이 화면까지 와서 의사를 밝힌 것"이므로 응답으로 친다 */
export function isAnswered(row: { answers?: unknown; skipped?: boolean } | null | undefined): boolean {
  if (!row) return false;
  return Boolean(row.skipped) || hasAnswers(row);
}
