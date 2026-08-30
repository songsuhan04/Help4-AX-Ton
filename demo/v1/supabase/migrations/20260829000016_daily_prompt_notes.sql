-- 주제가 검증에 걸려 버려졌을 때 그 이유를 남긴다.
--
-- 처음엔 console.error로만 찍었는데, Hobby 플랜은 런타임 로그를 1시간만 보관한다.
-- 새벽 3시에 찍힌 로그는 아침이면 사라져서, 실제로 탈락이 절반 넘게 났는데도 왜인지
-- 확인할 방법이 없었다. 판단 근거는 남아 있어야 한다.
--
-- 예: {"speech": "too_long", "letter": "medical_advice"}
alter table daily_prompt add column if not exists notes jsonb;
