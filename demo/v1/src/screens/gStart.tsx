import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { PasswordField } from "../components/PasswordField";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";

export const SCREEN_ID = "gStart";

export default function GStart() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "login">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(() => window.localStorage.getItem("callog.autoLogin") !== "false");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleAutoLogin(checked: boolean) {
    setAutoLogin(checked);
    window.localStorage.setItem("callog.autoLogin", String(checked));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/guardian");
    } catch (err) {
      setError(getErrorMessage(err, "로그인에 실패했습니다"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <img
        src="/callog-icon.png"
        alt="Callog(콜록)"
        width={64}
        height={64}
        style={{ borderRadius: 16, marginBottom: 16, display: "block" }}
      />
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
          <PasswordField
            label="비밀번호"
            value={password}
            onChange={setPassword}
            disabled={!supabaseConfigured}
            autoComplete="current-password"
          />
          <label className="g-check" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={autoLogin} onChange={(e) => toggleAutoLogin(e.target.checked)} />
            로그인 상태 유지
          </label>
          {error && <p className="g-error">{error}</p>}
          <button className="g-button" type="submit" disabled={loading || !supabaseConfigured}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
          <button type="button" className="g-button g-button--secondary" onClick={() => setMode("choose")}>
            뒤로
          </button>
        </form>
      )}

      <a href="/terms" target="_blank" rel="noreferrer" className="g-link g-link--block">
        이용약관 및 개인정보 처리 안내
      </a>
    </AppShell>
  );
}
