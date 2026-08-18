import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export function GuardianRoute({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    if (!supabaseConfigured) {
      setStatus("ok"); // 배너로 이미 안내되므로 라우트 자체는 막지 않음(스모크 테스트 목적)
      return;
    }
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        const session = data.session;
        // 익명 세션(어르신용)은 보호자 화면 접근 권한이 없음
        setStatus(session && !session.user.is_anonymous ? "ok" : "denied");
      });
  }, []);

  if (status === "checking") return null;
  if (status === "denied") return <Navigate to="/" replace />;
  return <>{children}</>;
}
