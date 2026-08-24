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

export async function deleteFromBucket(bucket: "voice" | "letters", path: string) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
