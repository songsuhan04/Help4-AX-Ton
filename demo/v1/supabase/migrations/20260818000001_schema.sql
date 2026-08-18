-- Callog(콜록) 스키마
-- 근거: docs/데이터스키마.md, plan(sorted-prancing-allen.md) §Supabase 스키마
-- 이 파일이 문서와 다른 부분은 각 CREATE TABLE 위 주석에 사유를 남긴다.

create extension if not exists pgcrypto;

create type risk_level as enum ('안전', '위험', '심각');
create type family_action_type as enum ('없음', '전화함', '확인함');
create type party_type as enum ('family', 'elder');

-- family_account (보호자 계정)
-- 문서와의 차이: password_hash 없음 — Supabase Auth(auth.users)가 자격증명을 관리한다.
create table family_account (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  auto_login boolean not null default true,
  created_at timestamptz not null default now()
);

-- auth.users에 새 사용자가 생기면 family_account 행을 자동 생성 (이메일 인증 완료 시점)
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.family_account (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- elder_profile (어르신 프로필) — 1가족(family_account) : N어르신 확정 구조
create table elder_profile (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references family_account (id) on delete cascade,
  name text not null,
  birth_date date,
  relationship text,
  gender text, -- 오픈 이슈: 팀 최종 확인 전까지 nullable, UI 노출 여부는 프론트에서만 제어
  nickname text,
  checkin_time time not null default '08:00',
  priority_status risk_level not null default '안전',
  created_at timestamptz not null default now()
);

create index elder_profile_family_idx on elder_profile (family_account_id);

-- elder_condition (지병목록)
-- 문서와의 차이: condition_type을 enum이 아닌 text로 — 14종 + 직접입력이라 enum이면 매번 마이그레이션이 필요해짐
create table elder_condition (
  id uuid primary key default gen_random_uuid(),
  elder_profile_id uuid not null references elder_profile (id) on delete cascade,
  condition_type text not null,
  custom_text text
);

create index elder_condition_elder_idx on elder_condition (elder_profile_id);

-- daily_checkin (일일응답기록) — 하루 1건, 재제출은 upsert
create table daily_checkin (
  id uuid primary key default gen_random_uuid(),
  elder_profile_id uuid not null references elder_profile (id) on delete cascade,
  date date not null default ((now() at time zone 'Asia/Seoul')::date),
  answers jsonb not null default '{}'::jsonb,
  condition_selfreport text,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (elder_profile_id, date)
);

create index daily_checkin_elder_idx on daily_checkin (elder_profile_id);

-- voice_response (음성응답) — Gemini 기반으로 전환 (기존 STT 문서 표현에서 변경)
create table voice_response (
  id uuid primary key default gen_random_uuid(),
  daily_checkin_id uuid not null unique references daily_checkin (id) on delete cascade,
  audio_url text,
  transcript text,
  speech_rate double precision, -- 오픈 이슈: Gemini 단독으로 안정 추출 가능한지 미검증, nullable 유지
  silence_ratio double precision,
  response_latency_ms integer, -- 클라이언트에서 측정
  analysis_json jsonb,
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'ok', 'failed', 'skipped')),
  shared_with_family boolean not null default true,
  created_at timestamptz not null default now()
);

-- risk_assessment (위험도이력)
-- 잠정값 안내: 위험 가중치·임계값은 기능설계서.md §3 참고 — 임상 근거 확보 전까지 팀 합의 잠정값
create table risk_assessment (
  id uuid primary key default gen_random_uuid(),
  elder_profile_id uuid not null references elder_profile (id) on delete cascade,
  date date not null default ((now() at time zone 'Asia/Seoul')::date),
  level risk_level not null,
  reason text not null,
  triggered_by jsonb not null default '{}'::jsonb,
  family_action family_action_type not null default '없음',
  created_at timestamptz not null default now(),
  unique (elder_profile_id, date)
);

create index risk_assessment_elder_idx on risk_assessment (elder_profile_id);

-- video_letter (영상편지)
-- Gemini 영상 분석 컬럼은 의도적으로 추가하지 않음 — 오픈 이슈 #1(정서적 톤 vs 안색·표정)이
-- 확정되기 전까지 "버림" 처리한 안색·표정 진단을 실수로 되살리지 않기 위함.
create table video_letter (
  id uuid primary key default gen_random_uuid(),
  sender_type party_type not null,
  sender_id uuid not null,
  receiver_type party_type not null,
  receiver_id uuid not null,
  title text not null,
  video_url text not null,
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  unlock_condition text not null default 'checkin_complete'
);

create index video_letter_receiver_idx on video_letter (receiver_type, receiver_id);

-- invite_link (초대링크) — 1회용
create table invite_link (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references family_account (id) on delete cascade,
  elder_profile_id uuid not null references elder_profile (id) on delete cascade,
  token text not null unique,
  device_fingerprint text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  revoked_at timestamptz
);

create index invite_link_elder_idx on invite_link (elder_profile_id);

-- elder_device (신규 — 데이터스키마.md에 없던 테이블)
-- "초대 링크는 1회용이지만, 한 번 연결되면 계정처럼 계속 유지"를 실제로 구현하려면
-- 어르신의 익명 세션(auth_user_id)과 프로필의 지속적 연결을 저장할 곳이 필요하다.
create table elder_device (
  id uuid primary key default gen_random_uuid(),
  elder_profile_id uuid not null references elder_profile (id) on delete cascade,
  invite_link_id uuid references invite_link (id) on delete set null,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  device_fingerprint text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (elder_profile_id, auth_user_id)
);

create index elder_device_auth_user_idx on elder_device (auth_user_id) where revoked_at is null;
