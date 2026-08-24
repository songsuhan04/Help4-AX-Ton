import { getSupabase } from "./supabase";

// 보호자 웹 푸시 알림 구독/해지.
//
// 위험도가 올라가도 보호자가 앱을 열어야만 알 수 있던 문제를 메우기 위한 것.
// 발송은 api/check-no-response.ts(크론)와 api/assess-risk.ts에서 서비스 롤로 수행한다.
//
// iOS는 사파리 탭에서는 구독이 안 되고 "홈 화면에 추가"로 설치한 경우에만 된다(iOS 16.4+).
// 그래서 지원 여부를 먼저 확인해 안내 문구를 다르게 보여준다.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushConfigured = Boolean(VAPID_PUBLIC_KEY);

/** 이 브라우저가 웹 푸시를 지원하는지 */
export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iOS 사파리는 홈 화면에 추가(standalone)한 경우에만 푸시가 된다 */
export function needsHomeScreenInstall(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (!isIOS) return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

// VAPID 공개키는 base64url 문자열인데 PushManager는 Uint8Array를 요구한다
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

/** 현재 이 기기가 알림을 구독 중인지 */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return false;
  return Boolean(await reg.pushManager.getSubscription());
}

/**
 * 알림 권한을 요청하고 구독 정보를 DB에 저장한다.
 * 권한을 거부하면 Error를 던지므로 호출부에서 문구로 안내한다.
 */
export async function subscribeToPush(): Promise<void> {
  if (!pushConfigured) throw new Error("알림 기능이 설정되지 않았습니다(VAPID 키 없음)");
  if (!pushSupported()) throw new Error("이 브라우저는 알림을 지원하지 않습니다");
  if (needsHomeScreenInstall()) {
    throw new Error("아이폰은 먼저 공유 버튼 → \"홈 화면에 추가\"로 설치한 뒤 알림을 켤 수 있습니다");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다. 브라우저 설정에서 이 사이트의 알림을 허용해주세요");
  }

  const reg = await getRegistration();
  // 이미 구독돼 있으면 그걸 그대로 쓰고, 없으면 새로 만든다
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("구독 정보를 만들지 못했습니다");
  }

  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("로그인이 필요합니다");

  // endpoint가 unique라 같은 기기에서 다시 켜도 행이 늘지 않는다
  const { error } = await supabase.from("push_subscription").upsert(
    {
      family_account_id: userData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

/** 구독을 해지하고 DB에서도 지운다 */
export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await getSupabase().from("push_subscription").delete().eq("endpoint", endpoint);
}
