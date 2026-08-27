import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { clearStoredElderProfileId, getStoredElderProfileId, touchElderDevice } from "../lib/elderSession";
import { supabaseConfigured } from "../lib/supabase";

export function ElderRoute({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    // DEV 전용 프리뷰 우회 — 실데이터 호출을 대체하는 목업이 아니라, 초대 링크 없이
    // 화면 레이아웃만 확인하기 위한 개발 편의 기능. 실제 Supabase 호출은 그대로 실행되고
    // 인증되지 않은 상태의 에러가 그대로 노출된다(가짜 데이터로 감추지 않음).
    const isPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");
    if (isPreview || !supabaseConfigured) {
      setStatus("ok");
      return;
    }
    if (!getStoredElderProfileId()) {
      setStatus("denied");
      return;
    }
    touchElderDevice().then((ok) => {
      // 연결이 끊긴 뒤에도 남아 있는 값을 지워둬야 다음 방문에서 곧바로 걸러진다
      if (!ok) clearStoredElderProfileId();
      setStatus(ok ? "ok" : "denied");
    });
  }, []);

  if (status === "checking") return null;
  if (status === "denied") return <Navigate to="/" replace />;
  return <>{children}</>;
}
