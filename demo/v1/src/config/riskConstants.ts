// 위험도 산정에 쓰이는 모든 잠정 수치는 이 파일에만 존재한다.
// 근거·경고: docs/기능설계서.md §3 — 임상적 근거가 확보되기 전까지는 팀 합의 잠정값이다.
export const RISK = {
  NO_RESPONSE_ALERT_HOURS: 7, // 잠정 — 무응답 위험 알림 임계 시간
  NO_OUTING_ALERT_DAYS: 3, // 잠정 — 연속 외출 없음 위험 알림 임계일
  MULTIPLIER: {
    htn_med_missed: 1.5, // 잠정 — 고혈압 보유자 복약 누락
    diabetes_meal_missed: 2.4, // 잠정 — 당뇨병 보유자 식사 결식(저혈당 우려)
  },
  VOICE_BASELINE_DAYS: 7, // 개인 기준선 비교에 사용할 최근 일수
} as const;

export type RiskLevel = "안전" | "위험" | "심각";
