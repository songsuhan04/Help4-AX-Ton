import { getSupabase } from "./supabase";
import { todaySeoul } from "./date";

// 경로 규칙: <elder_profile_id>/<yyyy-mm-dd>/<uuid>.<ext> — docs/기능설계서.md §Storage
export async function uploadToBucket(bucket: "voice" | "letters", elderProfileId: string, blob: Blob, ext: string) {
  const supabase = getSupabase();
  const date = todaySeoul();
  const path = `${elderProfileId}/${date}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(bucket: "voice" | "letters", path: string, expiresInSeconds = 3600) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * 다운로드 전용 서명 URL. <a download>는 다른 출처(supabase.co)의 파일에는 무시되기 때문에
 * 브라우저가 저장 대화상자를 띄우게 하려면 서버가 Content-Disposition: attachment를 보내야 한다.
 * Supabase의 download 옵션이 그 헤더를 붙여준다.
 * 근거: 실사용 피드백 — "우클릭 저장은 맥·핸드폰에서 불편하다"
 */
export async function getDownloadUrl(
  bucket: "voice" | "letters",
  path: string,
  fileName: string,
  expiresInSeconds = 3600
) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFromBucket(bucket: "voice" | "letters", path: string) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
