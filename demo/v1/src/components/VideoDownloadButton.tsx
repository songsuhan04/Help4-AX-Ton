import { useState } from "react";
import { getDownloadUrl } from "../lib/storage";

// 영상을 저장하는 버튼. 우클릭 → "다른 이름으로 저장"은 맥이나 휴대폰에서 번거롭거나
// 아예 불가능해서 명시적인 버튼을 둔다. 근거: 실사용 피드백
//
// 서명 URL은 만료되므로 미리 만들어두지 않고 누른 시점에 새로 발급받는다.
export function VideoDownloadButton({
  path,
  fileName,
  className = "e-secondary",
}: {
  path: string;
  fileName: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const url = await getDownloadUrl("letters", path, fileName);
      // 같은 탭에서 이동시키면 Content-Disposition: attachment 덕분에 저장 대화상자가 뜨고
      // 화면은 그대로 남는다. 새 창은 모바일에서 팝업 차단에 걸리기 쉽다.
      window.location.href = url;
    } catch {
      // 실패해도 화면을 막지 않는다 — 재생은 이미 가능한 상태다
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={download} disabled={busy}>
      {busy ? "준비 중..." : "⤓ 영상 저장"}
    </button>
  );
}
