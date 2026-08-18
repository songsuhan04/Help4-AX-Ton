-- 어르신 전화번호(전화하기 tel: 링크용) + 오늘의 안부 질문 세트 캐시(AI 생성 결과 저장, 재조회 시 일관성 유지)
alter table elder_profile add column if not exists phone text;
alter table daily_checkin add column if not exists questions jsonb;
