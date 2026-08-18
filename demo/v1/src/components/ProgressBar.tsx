export function ProgressBar({ current, total }: { current: number; total: number }) {
  return <div className="e-progress">{current} / {total}</div>;
}
