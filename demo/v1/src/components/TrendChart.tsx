import type { RiskLevel } from "../config/riskConstants";

// 기능설계서.md §1 "꺾은선 그래프 기록" — 최근 위험도 추이를 가벼운 인라인 SVG로 시각화한다.
// 차트 라이브러리를 새로 추가하지 않고 직접 그리는 이유: 점 개수가 최대 14개뿐이라
// 굳이 무거운 의존성을 늘릴 필요가 없음.
const LEVEL_Y: Record<RiskLevel, number> = { 안전: 0, 위험: 1, 심각: 2 };
const LEVEL_COLOR: Record<RiskLevel, string> = { 안전: "var(--jade)", 위험: "var(--gold)", 심각: "var(--red)" };

export interface TrendPoint {
  date: string; // yyyy-mm-dd
  level: RiskLevel | null; // null = 그날 기록 없음(결측)
}

const WIDTH = 320;
const HEIGHT = 120;
const PAD_X = 16;
const PAD_Y = 16;

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_Y * 2;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xFor = (i: number) => PAD_X + stepX * i;
  const yFor = (level: RiskLevel) => PAD_Y + innerH - (LEVEL_Y[level] / 2) * innerH;

  // 결측일(그날 안부 기록 없음)까지 억지로 잇지 않고, 연속된 구간끼리만 선을 그린다
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.level) {
      current.push({ x: xFor(i), y: yFor(p.level) });
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  });
  if (current.length) segments.push(current);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: "auto" }}>
      {(["안전", "위험", "심각"] as RiskLevel[]).map((level) => (
        <line
          key={level}
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={yFor(level)}
          y2={yFor(level)}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {segments.map((seg, si) => (
        <polyline key={si} points={seg.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--ink3)" strokeWidth={2} />
      ))}
      {points.map(
        (p, i) => p.level && <circle key={i} cx={xFor(i)} cy={yFor(p.level)} r={4} fill={LEVEL_COLOR[p.level]} />
      )}
      {points.map((p, i) => {
        if (points.length > 7 && i % 2 !== 0) return null;
        const label = `${Number(p.date.slice(5, 7))}/${Number(p.date.slice(8, 10))}`;
        return (
          <text key={`l${i}`} x={xFor(i)} y={HEIGHT - 2} fontSize={9} fill="var(--ink3)" textAnchor="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}
