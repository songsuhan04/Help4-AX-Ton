// 기능설계서.md §1 "연속 참여 기록". 오늘 기록이 아직 없어도 끊긴 게 아니라고 보고
// (하루가 아직 안 끝났으니) 어제부터 거슬러 올라가며 연속으로 기록이 있는 날 수를 센다.
export function computeStreak(dates: Iterable<string>): number {
  const set = new Set(dates);
  const cursor = new Date();
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
