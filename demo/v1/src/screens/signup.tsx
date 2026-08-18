import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "signup";

// 계정 만들기 1~2단계: 이메일 인증(OTP 코드) → 비밀번호. 3~4단계(어르신 정보/지병 선택)는
// reg.tsx/cond.tsx 라우트로 이어진다 — "어르신 추가" 흐름과 컴포넌트를 공유하기 위함.
export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 코드 발송에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 코드가 올바르지 않습니다");
    } finally {
      setLoading(false);
    }
  }

  async function setPasswordAndContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 다릅니다");
      return;
    }
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      navigate("/guardian/elders/new", { state: { fromSignup: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀번호 설정에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <BackButton to="/" />
      <div className="g-header">가족 · 계정 · {step} / 4 · {step === 1 ? "이메일" : "비밀번호"}</div>

      {step === 1 && !codeSent && (
        <form onSubmit={sendCode}>
          <h1 className="g-title">이메일을 알려주세요</h1>
          <p className="g-sub">인증 코드를 이 이메일로 보냅니다.</p>
          <div className="g-field">
            <label>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!supabaseConfigured} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink2)", marginBottom: 16 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            개인정보 수집·이용에 동의합니다
          </label>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
          <button className="g-button" type="submit" disabled={loading || !consent || !supabaseConfigured}>
            {loading ? "발송 중..." : "인증번호 받기"}
          </button>
        </form>
      )}

      {step === 1 && codeSent && (
        <form onSubmit={verifyCode}>
          <h1 className="g-title">인증 코드를 입력해주세요</h1>
          <p className="g-sub">{email}로 보낸 6자리 코드를 입력하세요.</p>
          <div className="g-field">
            <label>인증 코드</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
          <button className="g-button" type="submit" disabled={loading}>
            {loading ? "확인 중..." : "확인"}
          </button>
          <button type="button" className="g-button g-button--secondary" onClick={sendCode}>
            코드 재발송
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={setPasswordAndContinue}>
          <h1 className="g-title">비밀번호를 설정해주세요</h1>
          <div className="g-field">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="g-field">
            <label>비밀번호 확인</label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          </div>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
          <button className="g-button" type="submit" disabled={loading}>
            {loading ? "설정 중..." : "다음 — 어르신 정보"}
          </button>
        </form>
      )}
    </AppShell>
  );
}
