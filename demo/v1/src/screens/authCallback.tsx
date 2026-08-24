import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";

export const SCREEN_ID = "authCallback";

// 비밀번호 재설정 등 이메일 링크형 인증을 위한 안전망 — 주 흐름(OTP 코드)에서는 사용되지 않는다.
export default function AuthCallback() {
  return (
    <AppShell>
      <h1 className="g-title">처리 중입니다</h1>
      <p className="g-sub">인증이 완료되었습니다. 아래에서 계속하세요.</p>
      <Link className="g-button" to="/">
        시작 화면으로
      </Link>
    </AppShell>
  );
}
