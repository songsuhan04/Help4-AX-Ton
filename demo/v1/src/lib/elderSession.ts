import { getSupabase } from "./supabase";
import { getDeviceId } from "./deviceId";

const ELDER_PROFILE_KEY = "callog.elderProfileId";

export interface RedeemResult {
  elderProfileId: string;
  name: string;
}

// 초대 토큰을 익명 세션에 바인딩한다 (기기 변경/재초대 등 예외 처리는 redeem_invite RPC 내부에서 처리)
// 근거: docs/기능설계서.md §2.5, plan §"어르신 접근 방식"
export async function redeemInvite(token: string): Promise<RedeemResult> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc("redeem_invite", {
    p_token: token,
    p_device: getDeviceId(),
  });
  if (error) throw error;
  const result = data as RedeemResult;
  window.localStorage.setItem(ELDER_PROFILE_KEY, result.elderProfileId);
  return result;
}

export function getStoredElderProfileId(): string | null {
  return window.localStorage.getItem(ELDER_PROFILE_KEY);
}

export function clearStoredElderProfileId(): void {
  window.localStorage.removeItem(ELDER_PROFILE_KEY);
}

// 재방문 시 토큰 없이 세션 유효성만 가볍게 확인 ("계정처럼 계속 유지")
//
// touch_elder_device()는 연결이 끊겼을 때 에러를 내지 않고 false를 돌려준다. 예전에는
// 여기서 error만 보고 `return !error` 했는데, false가 와도 error는 null이라 항상 통과했다.
// 그래서 보호자가 어르신을 삭제해도(elder_device가 CASCADE로 사라져도) 어르신 기기에서는
// 예전 링크로 계속 설문이 됐다. 초대 해제도 같은 이유로 실제로 막히지 않았다.
// 반환값을 반드시 확인한다.
export async function touchElderDevice(): Promise<boolean> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return false;
  const { data, error } = await supabase.rpc("touch_elder_device");
  if (error) return false;
  return data === true;
}
