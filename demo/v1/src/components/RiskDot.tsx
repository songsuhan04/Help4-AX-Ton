import type { RiskLevel } from "../config/riskConstants";

const COLOR: Record<RiskLevel, string> = {
  안전: "var(--jade)",
  위험: "var(--gold)",
  심각: "var(--red)",
};

export function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: COLOR[level],
      }}
      aria-label={level}
    />
  );
}
