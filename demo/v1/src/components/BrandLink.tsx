import { useNavigate } from "react-router-dom";

// 사이드바(좁은 화면에서는 상단 띠)의 "Callog(콜록)"을 대상자 목록으로 가는 링크로 쓴다.
// 상세 화면에서 목록으로 돌아가는 버튼이 화면 폭에 따라 눈에 안 띄는 문제가 있어,
// 폭과 무관하게 항상 같은 자리에 있는 브랜드를 돌아가는 길로 만들었다.
// 근거: 실사용 피드백 — "왼쪽 위 콜록을 클릭하면 목록으로 돌아가게 하는 것도 괜찮을 것 같고"
export function BrandLink() {
  const navigate = useNavigate();
  return (
    <button type="button" className="g-brand g-brand--link" onClick={() => navigate("/guardian")} title="대상자 목록으로">
      Callog(콜록)
    </button>
  );
}
