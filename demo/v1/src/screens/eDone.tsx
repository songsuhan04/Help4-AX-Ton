import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSignedUrl } from "../lib/storage";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eDone";

interface LetterRow {
  id: string;
  title: string;
  video_url: string;
}

export default function EDone() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const [letter, setLetter] = useState<LetterRow | null>(null);
  const [letterUrl, setLetterUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const elderId = getStoredElderProfileId();
    const supabase = getSupabase();
    supabase
      .from("daily_checkin")
      .select("date", { count: "exact" })
      .eq("elder_profile_id", elderId)
      .eq("skipped", false)
      .then(({ count }) => setStreak(count ?? 0));
    supabase
      .from("video_letter")
      .select("id,title,video_url")
      .eq("receiver_type", "elder")
      .eq("receiver_id", elderId)
      .is("viewed_at", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLetter(data as LetterRow);
          getSignedUrl("letters", (data as LetterRow).video_url).then(setLetterUrl);
        }
      });
  }, []);

  const dots = Array.from({ length: 7 }, (_, i) => i < streak % 7 || streak >= 7);

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <span>Callog</span>
      </div>
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 40 }}>✓</div>
        <h1 style={{ fontSize: 26 }}>잘 하셨어요</h1>
        <p style={{ color: "rgba(255,255,255,0.75)" }}>오늘 안부를 가족에게 전했어요.</p>
        <div className="e-streak">
          {dots.map((filled, i) => (
            <span key={i} className={filled ? "e-streak-dot e-streak-dot--filled" : "e-streak-dot"} />
          ))}
        </div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{streak}일 연속 안부를 남기셨어요</p>
      </div>

      {letter && (
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>가족이 보냈어요</div>
          <div style={{ marginBottom: 8 }}>{letter.title}</div>
          {letterUrl && <video src={letterUrl} controls style={{ width: "100%", borderRadius: 8 }} />}
        </div>
      )}

      <SpeakButton text="오늘 안부를 가족에게 전했어요. 잘 하셨어요." />
      <button className="e-primary" onClick={() => navigate("/elder/record")}>
        영상편지 남기기
      </button>
      <button className="e-secondary" onClick={() => navigate("/elder/letters")}>
        가족 영상편지 모아보기
      </button>
      <button className="e-secondary" onClick={() => navigate("/elder/check")}>
        처음 화면으로
      </button>
    </AppShell>
  );
}
