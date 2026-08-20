import { useState, type ReactNode } from "react";

interface ConsentItemProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: ReactNode;
}

// 동의 체크박스 옆에 "자세히" 토글을 붙여 수집 항목/목적/보유기간을 펼쳐볼 수 있게 한다.
// 근거: 실사용 피드백 — "개인정보 동의를 좀 더 자세히 볼 수 있어야 하지 않을까"
export function ConsentItem({ checked, onChange, label, detail }: ConsentItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink2)", flex: 1 }}>
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required style={{ marginTop: 2 }} />
          <span>{label}</span>
        </label>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ fontSize: 12, color: "var(--dawn)", background: "none", border: "none", padding: 0, textDecoration: "underline", whiteSpace: "nowrap" }}
        >
          {open ? "접기" : "자세히"}
        </button>
      </div>
      {open && (
        <div style={{ fontSize: 12, color: "var(--ink3)", background: "var(--mist)", borderRadius: 8, padding: "10px 12px", marginTop: 6, marginLeft: 24, lineHeight: 1.7 }}>
          {detail}
        </div>
      )}
    </div>
  );
}
