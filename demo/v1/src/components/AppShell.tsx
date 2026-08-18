import type { ReactNode } from "react";
import { supabaseConfigured } from "../lib/supabase";

interface AppShellProps {
  variant?: "guardian" | "elder";
  children: ReactNode;
}

export function AppShell({ variant = "guardian", children }: AppShellProps) {
  return (
    <div className="app-shell">
      {!supabaseConfigured && (
        <div className="env-banner">Supabase 환경변수가 설정되지 않았습니다</div>
      )}
      <div className={variant === "elder" ? "app-card app-card--elder" : "app-card"}>{children}</div>
    </div>
  );
}
