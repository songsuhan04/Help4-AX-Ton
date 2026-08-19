// 위험도 산정에 쓰이는 모든 잠정 수치는 이 파일에 문서용으로 모아둔다.
// 근거·경고: docs/기능설계서.md §3 — 임상적 근거가 확보되기 전까지는 팀 합의 잠정값이다.
// ⚠️ 실제 집행(점수 계산)은 서버사이드 lib/riskScoring.ts(repo root)에 구현되어 있다 —
// 이 파일은 클라이언트 코드/문서가 참조하는 미러이며, 값을 바꿀 때 두 곳을 함께 수정해야 한다.
export const RISK = {
  NO_RESPONSE_ALERT_HOURS: 7, // 잠정 — 무응답 위험 알림 임계 시간 (아직 미구현, §6 오픈 이슈)
  NO_OUTING_ALERT_DAYS: 3, // 잠정 — 연속 외출 없음 위험 알림 임계일 (아직 미구현, §6 오픈 이슈)
  MULTIPLIER: {
    htn_med_missed: 1.5, // 잠정 — 고혈압 보유자 복약 누락
    diabetes_meal_missed: 2.4, // 잠정 — 당뇨병 보유자 식사 결식(저혈당 우려)
  },
  // 선택지 severity별 기본 점수 — lib/riskScoring.ts의 SEVERITY_POINTS와 동일해야 함
  SEVERITY_POINTS: { ok: 0, warn: 1, danger: 2 },
  // 합산 점수 → 등급 임계값 — lib/riskScoring.ts의 LEVEL_THRESHOLD와 동일해야 함
  LEVEL_THRESHOLD: { 심각: 3, 위험: 1 },
  VOICE_BASELINE_DAYS: 7, // 개인 기준선 비교에 사용할 최근 일수 (아직 미구현 — 정량 지표 신뢰도 검증 전, §6 오픈 이슈)
} as const;

export type RiskLevel = "안전" | "위험" | "심각";
