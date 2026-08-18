-- 익명(어르신) 사용자 생성 시 family_account를 만들지 않도록 수정
-- (익명 사용자는 email이 NULL인데 family_account.email이 not null이라 트리거가 실패했음
--  → "Database error creating anonymous user"로 나타남, 실사용 중 발견)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_anonymous then
    return new;
  end if;
  insert into public.family_account (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
