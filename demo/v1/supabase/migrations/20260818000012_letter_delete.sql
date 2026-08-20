-- 보호자가 잘못 보낸 영상편지를 직접 삭제할 수 있도록 허용.
-- 근거: 실사용 피드백 — "내가 영상을 잘못 찍어서 보낸 영상을 확인하고 지울 수 있으면 좋겠다"
create policy "family deletes own sent letters" on video_letter
  for delete using (sender_type = 'family' and sender_id = auth.uid() and is_real_user());

create policy "family deletes own letter files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'letters' and owns_elder(((storage.foldername(name))[1])::uuid) and is_real_user());
