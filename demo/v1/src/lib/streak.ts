import { shiftDateString, todaySeoul } from "./date";

// 기능설계서.md §1 "연속 참여 기록". 오늘 기록이 아직 없어도 끊긴 게 아니라고 보고
// (하루가 아직 안 끝났으니) 어제부터 거슬러 올라가며 연속으로 기록이 있는 날 수를 센다.
//
// 날짜는 DB의 date 컬럼과 같은 기준(한국 시간)이어야 한다 — lib/date.ts 참고.
export function computeStreak(dates: Iterable<string>): number {
  const set = new Set(dates);
  let cursor = todaySeoul();
  if (!set.has(cursor)) {
    cursor = shiftDateString(cursor, -1);
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = shiftDateString(cursor, -1);
  }
  return streak;
}
