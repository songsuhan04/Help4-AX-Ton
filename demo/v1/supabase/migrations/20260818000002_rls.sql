-- Row Level Security — plan(sorted-prancing-allen.md) §Supabase 스키마 참고

create function is_real_user() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

create function owns_elder(p_elder uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from elder_profile e
    where e.id = p_elder and e.family_account_id = auth.uid()
  );
$$;

create function is_my_elder(p_elder uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from elder_device d
    where d.elder_profile_id = p_elder
      and d.auth_user_id = auth.uid()
      and d.revoked_at is null
  );
$$;

alter table family_account enable row level security;
alter table elder_profile enable row level security;
alter table elder_condition enable row level security;
alter table daily_checkin enable row level security;
alter table voice_response enable row level security;
alter table risk_assessment enable row level security;
alter table video_letter enable row level security;
alter table invite_link enable row level security;
alter table elder_device enable row level security;

-- family_account: 본인 행만
create policy "family reads own account" on family_account
  for select using (id = auth.uid() and is_real_user());
create policy "family updates own account" on family_account
  for update using (id = auth.uid() and is_real_user());

-- elder_profile: 보호자는 자기 어르신 전체 CRUD, 어르신은 자기 프로필만 조회
create policy "family manages own elders" on elder_profile
  for all using (family_account_id = auth.uid() and is_real_user())
  with check (family_account_id = auth.uid() and is_real_user());
create policy "elder reads own profile" on elder_profile
  for select using (is_my_elder(id));

-- elder_condition: 보호자 CRUD, 어르신 조회
create policy "family manages elder conditions" on elder_condition
  for all using (owns_elder(elder_profile_id) and is_real_user())
  with check (owns_elder(elder_profile_id) and is_real_user());
create policy "elder reads own conditions" on elder_condition
  for select using (is_my_elder(elder_profile_id));

-- daily_checkin: 어르신 본인이 쓰고 읽음, 보호자는 조회만
create policy "elder manages own checkins" on daily_checkin
  for all using (is_my_elder(elder_profile_id))
  with check (is_my_elder(elder_profile_id));
create policy "family reads elder checkins" on daily_checkin
  for select using (owns_elder(elder_profile_id) and is_real_user());

-- voice_response: daily_checkin을 통해 소유권 판단
create policy "elder manages own voice" on voice_response
  for all using (
    exists (select 1 from daily_checkin c where c.id = daily_checkin_id and is_my_elder(c.elder_profile_id))
  )
  with check (
    exists (select 1 from daily_checkin c where c.id = daily_checkin_id and is_my_elder(c.elder_profile_id))
  );
create policy "family reads elder voice" on voice_response
  for select using (
    exists (select 1 from daily_checkin c where c.id = daily_checkin_id and owns_elder(c.elder_profile_id) and is_real_user())
  );

-- risk_assessment: 보호자만 — 어르신은 자기 위험도 등급을 볼 수 없음("진단 아닌 확인" 포지셔닝)
create policy "family reads risk" on risk_assessment
  for select using (owns_elder(elder_profile_id) and is_real_user());
create policy "family updates risk action" on risk_assessment
  for update using (owns_elder(elder_profile_id) and is_real_user());
-- insert는 서비스 롤(서버)에서만 수행 — 클라이언트 정책 없음

-- video_letter: 발신/수신 당사자만
create policy "family sends letters" on video_letter
  for insert with check (sender_type = 'family' and sender_id = auth.uid() and is_real_user());
create policy "family reads own letters" on video_letter
  for select using (
    (sender_type = 'family' and sender_id = auth.uid() and is_real_user())
    or (receiver_type = 'family' and receiver_id = auth.uid() and is_real_user())
  );
create policy "elder sends letters" on video_letter
  for insert with check (sender_type = 'elder' and is_my_elder(sender_id));
create policy "elder reads own letters" on video_letter
  for select using (
    (sender_type = 'elder' and is_my_elder(sender_id))
    or (receiver_type = 'elder' and is_my_elder(receiver_id))
  );
create policy "elder marks letter viewed" on video_letter
  for update using (receiver_type = 'elder' and is_my_elder(receiver_id));

-- invite_link, elder_device: 클라이언트 직접 접근 정책 없음 — SECURITY DEFINER RPC로만 조작
