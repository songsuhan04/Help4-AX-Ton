import type { ButtonHTMLAttributes } from "react";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

// 어르신 화면 전용 — 큰 터치 타깃의 주 액션 버튼
export function BigButton({ variant = "primary", className, ...rest }: BigButtonProps) {
  const cls = variant === "primary" ? "e-primary" : "e-secondary";
  return <button className={[cls, className].filter(Boolean).join(" ")} {...rest} />;
}
