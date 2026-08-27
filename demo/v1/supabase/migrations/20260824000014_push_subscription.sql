-- 보호자 브라우저의 Web Push 구독 정보.
--
-- ⚠️ 이 파일은 나중에 뒤늦게 채워 넣은 것이다. 실제로는 2026-08-24에 DB에 직접 적용했고
-- 파일을 남기지 않아, 리포지토리만 보고 DB를 다시 만들면 이 표가 빠졌다. 내용은 운영
-- DB의 실제 정의(information_schema, pg_policies, pg_constraint)를 그대로 옮긴 것이다.

create table if not exists push_subscription (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references family_account(id) on delete cascade,
  -- 브라우저가 주는 푸시 수신 주소. 같은 브라우저가 다시 구독하면 같은 값이 오므로
  -- unique로 두어 중복 구독이 쌓이지 않게 한다.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  -- 마지막으로 이 구독에 실제로 보낸 시각. 만료된 구독을 걸러낼 때 참고한다.
  last_sent_at timestamptz
);

alter table push_subscription enable row level security;

-- 본인 계정의 구독만 등록·조회·삭제한다. 발송은 service_role이 하므로 별도 정책이 없다.
create policy "family manages own push subscriptions" on push_subscription
  for all
  using (family_account_id = auth.uid() and is_real_user())
  with check (family_account_id = auth.uid() and is_real_user());
