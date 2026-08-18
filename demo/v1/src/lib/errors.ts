// Supabase의 PostgrestError/AuthError는 항상 `instanceof Error`가 아니다 (PostgrestError는 일반
// 객체 { message, details, hint, code }). `err instanceof Error`로만 분기하면 실제 원인이
// 화면에서 사라지고 fallback 문구만 보이는 문제가 있어(redeem_invite RPC 에러에서 실사용 중 발견),
// message 속성이 있는 값이면 항상 그것을 쓰도록 통일한다.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}
