import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";

export const SCREEN_ID = "signup";

// 계정 만들기 1~2단계: 이메일+비밀번호로 즉시 가입(이메일 인증 없음 — Supabase Auth의
// "Confirm email"을 꺼둔 상태를 전제로 한다. Resend 샌드박스 제약(계정 소유자 본인 외
// 발송 불가)으로 팀원 가입이 막혔던 문제를 해결하기 위해 OTP 코드 이메일 흐름을 제거했다.
// 3~4단계(어르신 정보/지병 선택)는 reg.tsx/cond.tsx 라우트로 이어진다.
export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentOverseas, setConsentOverseas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 다릅니다");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await getSupabase().auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        // "Confirm email"이 켜져 있는 환경이라면 세션이 바로 생기지 않는다 — 로그인 화면으로 안내
        navigate("/");
        return;
      }
      navigate("/guardian/elders/new", { state: { fromSignup: true } });
    } catch (err) {
      setError(getErrorMessage(err, "가입에 실패했습니다"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <BackButton to="/" />
      <div className="g-header">가족 · 계정 만들기</div>
      <h1 className="g-title">이메일과 비밀번호를 입력해주세요</h1>
      <form onSubmit={handleSubmit}>
        <div className="g-field">
          <label>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!supabaseConfigured} />
        </div>
        <div className="g-field">
          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={!supabaseConfigured}
          />
        </div>
        <div className="g-field">
          <label>비밀번호 확인</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            disabled={!supabaseConfigured}
          />
        </div>
        {/* 개인정보보호법 §23·§28-8 대응 — 일반 개인정보 동의와 국외이전(Google Gemini) 동의를
            분리된 체크박스로 구성. 근거: Help4/법적문제 피해가기 공략.pdf §1, §3, 체크리스트 1번 */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink2)", marginBottom: 10 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required style={{ marginTop: 2 }} />
          <span>[필수] 개인정보 수집·이용에 동의합니다</span>
        </label>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink2)", marginBottom: 16 }}>
          <input type="checkbox" checked={consentOverseas} onChange={(e) => setConsentOverseas(e.target.checked)} required style={{ marginTop: 2 }} />
          <span>
            [필수] 개인정보 국외 이전에 동의합니다
            <br />
            <span style={{ fontSize: 12, color: "var(--ink3)" }}>
              수령자: Google LLC (Gemini API) · 이전 항목: 음성·안부 체크리스트 데이터 · 목적: AI 기반 안부 분석
            </span>
          </span>
        </label>
        {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
        <button className="g-button" type="submit" disabled={loading || !consent || !consentOverseas || !supabaseConfigured}>
          {loading ? "가입 중..." : "다음 — 어르신 정보"}
        </button>
      </form>
    </AppShell>
  );
}
