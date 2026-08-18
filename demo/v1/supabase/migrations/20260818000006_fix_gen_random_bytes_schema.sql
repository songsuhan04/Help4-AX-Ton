-- gen_random_bytes는 public이 아니라 extensions 스키마에 설치되어 있음 — 스키마 명시로 수정
-- (실제 사용 중 "function gen_random_bytes(integer) does not exist" 에러로 발견됨)
create or replace function create_invite(p_elder uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
begin
  if not owns_elder(p_elder) or not is_real_user() then
    raise exception 'not_authorized';
  end if;

  update invite_link
    set revoked_at = now()
    where elder_profile_id = p_elder and used_at is null and revoked_at is null;

  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');

  insert into invite_link (family_account_id, elder_profile_id, token)
  values (auth.uid(), p_elder, v_token);

  return v_token;
end;
$$;
