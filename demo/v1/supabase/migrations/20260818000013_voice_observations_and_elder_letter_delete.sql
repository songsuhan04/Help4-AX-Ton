-- 음성 AI 소견(observations)을 별도 컬럼으로 보존 — 지금까지는 analysis_json.raw 안에만 있어 화면에 노출되지 않았음.
-- 근거: 실사용 피드백 — "음성 AI가 판별해서 알려주는 문구가 안 보인다"
alter table voice_response add column if not exists observations text;

-- 보호자가 어르신이 보낸 영상편지도 삭제할 수 있도록 허용(가족이 보낸 편지 삭제는 20260818000012에서 이미 허용).
-- storage 파일 삭제는 폴더가 elderId 기준이라 기존 "family deletes own letter files" 정책이 그대로 적용된다.
create policy "family deletes elder-sent letters" on video_letter
  for delete using (sender_type = 'elder' and owns_elder(sender_id) and is_real_user());
