-- 관리자 계정: 전체 어르신 위험도 현황을 모니터링하는 읽기 전용 대시보드.
-- 화이트리스트에 등록된 이메일로 로그인한 계정만 모든 가족의 데이터를 조회할 수 있다(쓰기 권한 없음).
create table if not exists admin_whitelist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table admin_whitelist enable row level security;
-- 화이트리스트 테이블 자체는 클라이언트에서 직접 조회/수정할 수 없다(is_admin() 내부에서만 참조).

create or replace function is_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_whitelist where email = auth.jwt() ->> 'email'
  );
$$;

create policy "admin reads all elder_profile" on elder_profile for select using (is_admin());
create policy "admin reads all risk_assessment" on risk_assessment for select using (is_admin());
create policy "admin reads all daily_checkin" on daily_checkin for select using (is_admin());
create policy "admin reads all family_account" on family_account for select using (is_admin());
