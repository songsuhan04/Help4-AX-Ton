// 통신비밀보호법/민법(타인 초상권·음성권) 대응 — 녹화/녹음 화면에 상시 노출.
// 근거: Help4/법적문제 피해가기 공략.pdf §5, 체크리스트 4번
export function RecordingNotice() {
  return (
    <p className="e-notice">
      본인의 음성/모습만 녹화해 주세요. 타인의 동의 없는 촬영은 법적 책임을 질 수 있습니다.
    </p>
  );
}
