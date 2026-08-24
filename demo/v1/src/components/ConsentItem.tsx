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
    <div className="g-consent">
      <div className="g-consent-row">
        <label className="g-check">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required />
          <span>{label}</span>
        </label>
        <button type="button" className="g-consent-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "접기" : "자세히"}
        </button>
      </div>
      {open && <div className="g-consent-detail">{detail}</div>}
    </div>
  );
}
