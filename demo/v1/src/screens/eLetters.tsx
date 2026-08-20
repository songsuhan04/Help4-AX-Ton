import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSignedUrl } from "../lib/storage";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eLetters";

// 어르신이 가족에게서 받은 영상편지를 전부 모아 다시 볼 수 있는 화면.
// 완료 화면(eDone)은 가장 최근 미확인 편지 1개만 보여줘서, 예전 편지를 다시 보거나
// 여러 편지를 한 번에 모아볼 방법이 없었다. 근거: 실사용 피드백 — "모아보는 화면이 없다"
interface LetterRow {
  id: string;
  title: string;
  video_url: string;
  sent_at: string;
  viewed_at: string | null;
  signedUrl?: string;
}

export default function ELetters() {
  const navigate = useNavigate();
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const elderId = getStoredElderProfileId();
    const supabase = getSupabase();
    supabase
      .from("video_letter")
      .select("id,title,video_url,sent_at,viewed_at")
      .eq("receiver_type", "elder")
      .eq("receiver_id", elderId)
      .order("sent_at", { ascending: false })
      .then(async ({ data }) => {
        const rows = (data ?? []) as LetterRow[];
        const withUrls = await Promise.all(
          rows.map(async (row) => ({ ...row, signedUrl: await getSignedUrl("letters", row.video_url).catch(() => undefined) }))
        );
        setLetters(withUrls);
        setLoading(false);
      });
  }, []);

  async function markViewed(letter: LetterRow) {
    if (letter.viewed_at) return;
    const viewedAt = new Date().toISOString();
    await getSupabase().from("video_letter").update({ viewed_at: viewedAt }).eq("id", letter.id);
    setLetters((prev) => prev.map((l) => (l.id === letter.id ? { ...l, viewed_at: viewedAt } : l)));
  }

  return (
    <AppShell variant="elder">
      <button
        className="e-secondary"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 12, width: "auto", padding: "8px 16px" }}
      >
        ← 이전 화면
      </button>
      <div className="e-topbar">
        <span>영상편지 모아보기</span>
      </div>
      <h1 className="e-question" style={{ fontSize: 24 }}>가족이 보낸 영상편지</h1>

      {loading && <p style={{ color: "rgba(255,255,255,0.7)" }}>불러오는 중...</p>}
      {!loading && letters.length === 0 && (
        <p style={{ color: "rgba(255,255,255,0.7)" }}>아직 받은 영상편지가 없습니다.</p>
      )}

      {letters.map((letter) => (
        <div key={letter.id} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              {new Date(letter.sent_at).toLocaleString("ko-KR")}
            </div>
            {!letter.viewed_at && <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 700 }}>새 편지</span>}
          </div>
          <div style={{ marginBottom: 8, fontSize: 17 }}>{letter.title}</div>
          {letter.signedUrl && (
            <video
              src={letter.signedUrl}
              controls
              style={{ width: "100%", borderRadius: 10 }}
              onPlay={() => markViewed(letter)}
            />
          )}
        </div>
      ))}
    </AppShell>
  );
}
