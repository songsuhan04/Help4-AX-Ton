import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { DisplaySettings } from "../components/DisplaySettings";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { computeStreak } from "../lib/streak";

export const SCREEN_ID = "eHome";

const today = () => new Date().toISOString().slice(0, 10);

// 어르신이 언제든 돌아올 수 있는 진짜 "처음 화면". 예전엔 완료 화면들의
// "처음 화면으로" 버튼이 안부 설문 시작 화면(/elder/check)으로 보냈는데,
// 오늘 이미 다 마쳤어도 설문이 처음부터 다시 시작되는 문제가 있었다.
// 근거: 실사용 피드백 — "처음 화면을 하나 만드는 게 어떨까"
export default function EHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [doneToday, setDoneToday] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const elderId = getStoredElderProfileId();
    const supabase = getSupabase();
    supabase
      .from("daily_checkin")
      .select("answers,skipped")
      .eq("elder_profile_id", elderId)
      .eq("date", today())
      .maybeSingle()
      .then(({ data }) => {
        setDoneToday(Boolean(data?.skipped || (Array.isArray(data?.answers) && data.answers.length > 0)));
        setLoading(false);
      });
    supabase
      .from("daily_checkin")
      .select("date")
      .eq("elder_profile_id", elderId)
      .eq("skipped", false)
      .order("date", { ascending: false })
      .limit(400)
      .then(({ data }) => setStreak(computeStreak((data ?? []).map((r) => r.date as string))));
  }, []);

  if (loading) return <AppShell variant="elder"><p className="e-lead">불러오는 중...</p></AppShell>;

  const message = doneToday ? "오늘 안부는 이미 전했어요" : "오늘 안부를 전해볼까요?";

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <DisplaySettings />
        <span className="e-brand">Callog</span>
      </div>
      <div className="e-hero">
        <h1 className="e-question">{message}</h1>
        {streak > 0 && <p className="e-meta">{streak}일 연속 참여 중이에요</p>}
      </div>

      <SpeakButton text={message} />

      {!doneToday && (
        <button className="e-primary" onClick={() => navigate("/elder/check")}>
          안부 시작하기
        </button>
      )}
      <button className="e-secondary" onClick={() => navigate("/elder/record")}>
        영상편지 남기기
      </button>
      <button className="e-secondary" onClick={() => navigate("/elder/letters")}>
        가족 영상편지 모아보기
      </button>
    </AppShell>
  );
}
