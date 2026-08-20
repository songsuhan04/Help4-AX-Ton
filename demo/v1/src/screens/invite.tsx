import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getRpcErrorMessage } from "../lib/errors";

export const SCREEN_ID = "invite";

export default function Invite() {
  const { elderId } = useParams<{ elderId: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    getSupabase()
      .rpc("create_invite", { p_elder: elderId })
      .then(({ data, error }) => {
        if (error) setError(getRpcErrorMessage(error, "초대 링크 생성에 실패했습니다"));
        else setLink(`${window.location.origin}/e/${data as string}`);
        setLoading(false);
      });
  }, [elderId]);

  function copy() {
    if (link) navigator.clipboard.writeText(link);
  }

  const smsHref = link ? `sms:${phone}?&body=${encodeURIComponent(`Callog 초대: ${link}`)}` : undefined;

  return (
    <AppShell>
      <BackButton />
      <div className="g-header">초대</div>
      <h1 className="g-title">어르신께 링크를 보내세요</h1>
      <p className="g-sub">어르신은 이 링크만 한 번 누르면 됩니다.</p>

      {loading && <p>링크 생성 중...</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

      {link && (
        <>
          <div className="g-field">
            <label>초대 링크</label>
            <input value={link} readOnly />
          </div>
          <button className="g-button g-button--secondary" onClick={copy}>
            링크 복사
          </button>

          <div className="g-field" style={{ marginTop: 16 }}>
            <label>어르신 전화번호 (문자로 보내기)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
          </div>
          <a className="g-button" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={smsHref}>
            문자로 보내기
          </a>

          <button
            className="g-button g-button--secondary"
            style={{ marginTop: 16 }}
            onClick={() => navigate("/guardian/elders/new")}
          >
            어르신 추가
          </button>
          <button className="g-button" onClick={() => navigate("/guardian")}>
            완료 — 대상자 목록으로
          </button>
        </>
      )}
    </AppShell>
  );
}
