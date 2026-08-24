import type { RiskLevel } from "../config/riskConstants";

const COLOR: Record<RiskLevel, string> = {
  안전: "var(--safe)",
  위험: "var(--warn)",
  심각: "var(--crit)",
};

export function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        flex: "none",
        background: COLOR[level],
        boxShadow: "0 0 0 3px rgba(255,255,255,0.05)",
      }}
      aria-hidden="true"
    />
  );
}

// 색맹·저조도에서 점 하나만으로는 등급이 구분되지 않는다. 등급 글자를 함께 내보내는 배지.
export function RiskPill({ level }: { level: RiskLevel }) {
  return <span className={`g-pill g-pill--${level}`}>{level}</span>;
}
