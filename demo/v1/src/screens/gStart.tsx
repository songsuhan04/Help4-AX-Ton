import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "gStart";

export default function GStart() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "login">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/guardian");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="g-header">Callog(콜록)</div>
      <h1 className="g-title">보호자로 시작하기</h1>
      <p className="g-sub">어르신을 등록하고 초대하면, 어르신은 링크만 한 번 누르면 됩니다.</p>

      {mode === "choose" && (
        <>
          <button className="g-button" onClick={() => navigate("/signup")}>
            처음이에요 — 계정 만들고 어르신 등록하기
          </button>
          <button className="g-button g-button--secondary" onClick={() => setMode("login")}>
            이미 계정이 있어요
          </button>
        </>
      )}

      {mode === "login" && (
        <form onSubmit={handleLogin}>
          <div className="g-field">
            <label>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!supabaseConfigured} />
          </div>
          <div className="g-field">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!supabaseConfigured} />
          </div>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
          <button className="g-button" type="submit" disabled={loading || !supabaseConfigured}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
          <button type="button" className="g-button g-button--secondary" onClick={() => setMode("choose")}>
            뒤로
          </button>
        </form>
      )}
    </AppShell>
  );
}
