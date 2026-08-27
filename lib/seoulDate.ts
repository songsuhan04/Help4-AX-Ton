// 서버(크론·API)에서 쓰는 한국 시간 helper.
//
// DB의 date 컬럼이 (now() at time zone 'Asia/Seoul')::date 기준이므로 서버 코드도 같은
// 기준을 써야 한다. toISOString()을 쓰면 UTC 날짜가 되어 한국 자정~오전 9시 사이에
// 하루 전 날짜를 보게 된다. 클라이언트 쪽 규칙은 demo/v1/src/lib/date.ts에 같은 내용이 있다.

/** 한국 시간 기준 오늘 날짜(yyyy-mm-dd) */
export function todaySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * 한국 시간의 시:분을 그대로 담은 Date — 시각 비교(마감 시각 등)에만 쓴다.
 * Z를 붙여 UTC로 못박아, 서버 타임존이 UTC가 아니어도 해석이 달라지지 않게 한다.
 */
export function seoulNow(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`);
}
