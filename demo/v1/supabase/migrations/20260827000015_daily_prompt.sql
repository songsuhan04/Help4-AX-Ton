-- 그날의 안부 질문과 녹음 주제를 새벽 크론이 미리 만들어 담아두는 표.
--
-- 예전에는 어르신이 안부 화면을 열 때 Gemini를 호출해서 그날 첫 사용자가 기다려야 했다.
-- 근거: 실사용 피드백 — "버퍼링이 걸리더라"
--
-- daily_checkin에 넣지 않는 이유: 보호자 목록이 "그 날 daily_checkin 행이 있으면 오늘
-- 완료"로 판단한다. 미리 행을 만들면 아무도 답하지 않은 날까지 완료로 보인다. 미리
-- 만들어두는 것과 실제로 답한 기록은 성격이 다르므로 따로 둔다.
--
-- 채우는 쪽: lib/prepareDailyPrompts.ts (api/cleanup-old-letters.ts 크론에서 호출)
-- 읽는 쪽: demo/v1/src/lib/dailyPrompt.ts

create table if not exists daily_prompt (
  elder_profile_id uuid not null references elder_profile(id) on delete cascade,
  date date not null,
  questions jsonb,
  -- 검증에 걸린 주제는 null로 남는다 — 그 경우 화면이 고정 목록을 쓴다
  speech_topic text,
  letter_topic text,
  -- 'gemini' | 'fallback' — AI가 실제로 쓰였는지 나중에 확인할 수 있게 남긴다
  source text not null default 'fallback',
  created_at timestamptz not null default now(),
  primary key (elder_profile_id, date)
);

alter table daily_prompt enable row level security;

-- 쓰기는 크론(service_role)만 한다. service_role은 RLS를 우회하므로 쓰기 정책을 두지 않는다.
create policy "elder reads own daily_prompt" on daily_prompt
  for select using (is_my_elder(elder_profile_id));

create policy "family reads own elder daily_prompt" on daily_prompt
  for select using (owns_elder(elder_profile_id));

create policy "admin reads all daily_prompt" on daily_prompt
  for select using (is_admin());
