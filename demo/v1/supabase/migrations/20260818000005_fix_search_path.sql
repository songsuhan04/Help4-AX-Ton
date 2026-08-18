-- Supabase 보안 어드바이저(get_advisors) 지적사항 수정: search_path 미고정
create or replace function is_real_user() returns boolean
language sql stable security invoker set search_path = public as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;
