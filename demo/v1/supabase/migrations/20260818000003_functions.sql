-- 초대 링크 생성/redeem/기기 유지/재초대 RPC
-- 근거: docs/기능설계서.md §2.5(예외 처리 4가지), plan §"어르신 접근 방식"

-- 보호자가 호출: 새 1회용 초대 링크 발급. 같은 어르신의 미사용 초대는 무효화.
create function create_invite(p_elder uuid) returns text
language plpgsql security definer set search_path = public as $$
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

-- 어르신(익명 세션)이 호출: 토큰을 현재 세션에 바인딩.
-- 기기 변경/재초대/링크 유출 예외 처리(화면설계서.md §5)를 여기서 전부 처리한다.
create function redeem_invite(p_token text, p_device text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_link invite_link;
  v_elder elder_profile;
  v_existing elder_device;
begin
  select * into v_link from invite_link where token = p_token;
  if v_link.id is null then
    raise exception 'invalid_token';
  end if;
  if v_link.revoked_at is not null then
    raise exception 'revoked';
  end if;
  if v_link.expires_at < now() then
    raise exception 'expired';
  end if;

  if v_link.used_at is null then
    -- 최초 사용: 이 기기/세션에 확정 바인딩
    update invite_link set used_at = now(), device_fingerprint = p_device where id = v_link.id;
    insert into elder_device (elder_profile_id, invite_link_id, auth_user_id, device_fingerprint)
    values (v_link.elder_profile_id, v_link.id, auth.uid(), p_device)
    on conflict (elder_profile_id, auth_user_id) do update
      set invite_link_id = excluded.invite_link_id,
          device_fingerprint = excluded.device_fingerprint,
          revoked_at = null,
          last_seen_at = now();
  else
    -- 이미 사용된 링크: 같은 세션이거나 같은 기기 마커일 때만 재확인 허용
    select * into v_existing from elder_device
      where elder_profile_id = v_link.elder_profile_id
        and revoked_at is null
        and (auth_user_id = auth.uid() or device_fingerprint = p_device)
      limit 1;
    if v_existing.id is null then
      raise exception 'bound_to_other_device';
    end if;
    update elder_device set last_seen_at = now(), auth_user_id = auth.uid() where id = v_existing.id;
  end if;

  select * into v_elder from elder_profile where id = v_link.elder_profile_id;
  return json_build_object('elderProfileId', v_elder.id, 'name', v_elder.name);
end;
$$;

-- 어르신(익명 세션)이 재방문 시 호출: 세션 유효성 확인 + last_seen_at 갱신(무응답 신호의 입력값)
create function touch_elder_device() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update elder_device set last_seen_at = now()
    where auth_user_id = auth.uid() and revoked_at is null;
  return exists (
    select 1 from elder_device where auth_user_id = auth.uid() and revoked_at is null
  );
end;
$$;

-- 보호자가 호출: 휴대폰 분실 등으로 기존 기기 접근을 즉시 차단(다음 조회부터 반영)
create function revoke_elder_access(p_elder uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not owns_elder(p_elder) or not is_real_user() then
    raise exception 'not_authorized';
  end if;
  update elder_device set revoked_at = now() where elder_profile_id = p_elder and revoked_at is null;
  update invite_link set revoked_at = now() where elder_profile_id = p_elder and revoked_at is null;
end;
$$;
