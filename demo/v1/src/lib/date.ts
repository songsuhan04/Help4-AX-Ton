// 서비스 날짜는 항상 한국 시간(Asia/Seoul) 기준이다.
//
// DB의 daily_checkin.date / risk_assessment.date는 기본값이
// ((now() at time zone 'Asia/Seoul')::date)로 정의돼 있는데(migrations 20260818000001),
// 클라이언트가 new Date().toISOString()으로 날짜를 만들면 그건 UTC 기준이라
// 한국 시간 00:00~09:00 사이에는 두 값이 하루씩 어긋난다. 그 시간대에 어르신이
// 안부를 남기면 "오늘" 기록을 못 찾아 새 행을 만들거나, 보호자 화면이 어제 것을
// 오늘로 보여주는 문제가 생긴다. 날짜를 다루는 모든 코드는 이 함수를 쓴다.
const SEOUL_TZ = "Asia/Seoul";

/** 한국 시간 기준 오늘 날짜(yyyy-mm-dd) */
export function todaySeoul(): string {
  return toSeoulDateString(new Date());
}

/** 특정 시각의 한국 시간 기준 날짜(yyyy-mm-dd) */
export function toSeoulDateString(d: Date): string {
  // en-CA 로케일은 yyyy-mm-dd 형식을 그대로 준다
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** yyyy-mm-dd에서 n일 전/후 날짜(yyyy-mm-dd). 달력 날짜 연산이라 UTC 정오 기준으로 계산해 DST/타임존 영향을 받지 않는다 */
export function shiftDateString(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
