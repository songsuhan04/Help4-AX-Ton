import { useNavigate } from "react-router-dom";

// 기능설계서 §1: 모든 화면에 뒤로가기 버튼 필수
export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="g-back" onClick={() => (to ? navigate(to) : navigate(-1))}>
      ← 뒤로
    </button>
  );
}
