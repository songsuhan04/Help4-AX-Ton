// 몇 번째 질문인지 숫자로만 알리던 것을 칸으로 바꿨다.
// 숫자를 읽지 않아도 얼마나 남았는지 보이는 편이 어르신 화면에 맞는다.
export function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <>
      <div className="e-progress" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < current ? "e-progress-seg e-progress-seg--on" : "e-progress-seg"} />
        ))}
      </div>
      <div className="e-progress-label">
        {current} / {total}
      </div>
    </>
  );
}
