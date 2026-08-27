import { useState } from "react";

// 비밀번호 입력 + 보기/숨기기 토글.
// 화면이 가려진 채로 입력하면 오타를 알 수 없어 로그인 실패의 흔한 원인이 된다.
// 근거: 실사용 피드백 — "비밀번호 입력할 때 숨긴 번호 보기 버튼이 있으면 좋겠다"
export function PasswordField({
  label,
  value,
  onChange,
  disabled,
  minLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="g-field">
      <label>{label}</label>
      <div className="g-password">
        <input
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="g-password-toggle"
          onClick={() => setShown((s) => !s)}
          // 눈 아이콘만 두면 무슨 상태인지 알기 어려워 글자로 표시한다
          aria-label={shown ? "비밀번호 숨기기" : "비밀번호 보기"}
        >
          {shown ? "숨기기" : "보기"}
        </button>
      </div>
    </div>
  );
}
