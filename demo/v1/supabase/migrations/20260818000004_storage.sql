-- Storage 버킷 — 경로 규칙: <elder_profile_id>/<yyyy-mm-dd>/<uuid>.<ext>
-- 근거: plan(sorted-prancing-allen.md) §Supabase 스키마

insert into storage.buckets (id, name, public)
values ('voice', 'voice', false), ('letters', 'letters', false)
on conflict (id) do nothing;

create policy "elder uploads voice" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice' and is_my_elder(((storage.foldername(name))[1])::uuid));

create policy "family reads voice" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice' and owns_elder(((storage.foldername(name))[1])::uuid) and is_real_user());

create policy "elder reads own voice" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice' and is_my_elder(((storage.foldername(name))[1])::uuid));

create policy "family uploads letters" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'letters' and owns_elder(((storage.foldername(name))[1])::uuid) and is_real_user());

create policy "elder uploads letters" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'letters' and is_my_elder(((storage.foldername(name))[1])::uuid));

create policy "family reads letters" on storage.objects
  for select to authenticated
  using (bucket_id = 'letters' and owns_elder(((storage.foldername(name))[1])::uuid) and is_real_user());

create policy "elder reads letters" on storage.objects
  for select to authenticated
  using (bucket_id = 'letters' and is_my_elder(((storage.foldername(name))[1])::uuid));
