import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

// 보호자에게 웹 푸시를 보낸다. 위험도가 올라가도 보호자가 앱을 열어야만 알 수 있던
// 문제를 메우기 위한 것 — api/assess-risk.ts(안부 완료 시)와
// api/check-no-response.ts(무응답 크론) 양쪽에서 호출한다.
//
// VAPID 키가 없으면 조용히 아무것도 하지 않는다(다른 Gemini/Supabase 미설정 처리와 동일한 방식).

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    // mailto:는 푸시 서비스가 문제 발생 시 연락할 주소 — VAPID 규격 요구사항
    webpush.setVapidDetails("mailto:noreply@callog.app", publicKey, privateKey);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * 특정 보호자의 모든 기기에 알림을 보낸다.
 * 만료된 구독(404/410)은 DB에서 정리한다 — 그대로 두면 매번 실패한다.
 * 실패는 삼키고 count만 돌려준다. 알림은 부가 기능이라 실패가 본 작업을 막아선 안 된다.
 */
export async function sendPushToFamily(
  admin: SupabaseClient,
  familyAccountId: string,
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  const { data: subs, error } = await admin
    .from("push_subscription")
    .select("id,endpoint,p256dh,auth")
    .eq("family_account_id", familyAccountId);
  if (error) {
    console.error("sendPush: subscription query failed", error);
    return { sent: 0, removed: 0 };
  }

  let sent = 0;
  const staleIds: string[] = [];

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 = 구독이 영구히 사라짐(브라우저 데이터 삭제, 앱 제거 등)
      if (status === 404 || status === 410) staleIds.push(sub.id as string);
      else console.error("sendPush: send failed", status, err instanceof Error ? err.message : err);
    }
  }

  if (staleIds.length > 0) {
    await admin.from("push_subscription").delete().in("id", staleIds);
  }
  if (sent > 0) {
    await admin
      .from("push_subscription")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("family_account_id", familyAccountId);
  }

  return { sent, removed: staleIds.length };
}

/** 어르신 id로 보호자를 찾아 알림을 보낸다 */
export async function sendPushForElder(
  admin: SupabaseClient,
  elderProfileId: string,
  payload: PushPayload
): Promise<void> {
  const { data: elder } = await admin
    .from("elder_profile")
    .select("family_account_id")
    .eq("id", elderProfileId)
    .maybeSingle();
  if (!elder?.family_account_id) return;
  await sendPushToFamily(admin, elder.family_account_id as string, payload);
}
