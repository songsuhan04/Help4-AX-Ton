import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { RETENTION } from "../config/retention";

export const SCREEN_ID = "terms";

// 전자상거래법/약관규제법 대응 — 응급구조 서비스가 아니라는 점과 시스템 장애 시
// 알림 지연/누락에 대한 면책을 명시. 개인정보 처리 항목도 함께 요약해 signup.tsx/
// cond.tsx의 분리된 동의 체크박스가 무엇에 동의하는 것인지 확인할 수 있게 한다.
// 근거: Help4/법적문제 피해가기 공략.pdf §6, 체크리스트 5번
// ⚠️ 아래 내용은 팀이 정한 서비스 운영 방침을 문서화한 것이며, 정식 법률 검토를
// 대체하지 않는다. 실제 서비스 출시 전에는 변호사 등 전문가 검수가 필요하다.
export default function Terms() {
  return (
    <AppShell>
      <BackButton />
      <div className="g-header">이용약관 및 서비스 안내</div>
      <h1 className="g-title">Callog(콜록) 이용약관</h1>

      <section className="g-terms-section">
        <h2 className="g-terms-heading">1. 서비스 성격</h2>
        <p className="g-sub">
          Callog는 독거 어르신과 가족(보호자)이 매일 짧은 안부를 주고받도록 돕는 서비스입니다. 안부 응답과 음성을
          바탕으로 AI가 참고용 신호를 제공하지만, <strong>본 서비스는 의료기기나 의료 진단 서비스가 아닙니다.</strong> AI
          분석 결과는 일상 안부 확인을 위한 참고용 신호일 뿐이며, 정확한 건강 상태는 반드시 전문 의료기관의 진료를
          받으시기 바랍니다.
        </p>
      </section>

      <section className="g-terms-section">
        <h2 className="g-terms-heading">2. 응급 상황 및 알림 관련 면책</h2>
        <p className="g-sub">
          본 서비스는 119 등 응급 구조 서비스가 아니며, 응급 상황을 감지하거나 신고하지 않습니다. 네트워크·서버 장애,
          어르신의 기기 문제 등으로 인해 위험 알림이 지연되거나 누락될 수 있습니다. 위험 알림 수신 여부와 관계없이
          보호자는 평소 어르신과의 직접 연락을 병행해야 하며, 응급 상황이 의심되면 즉시 119 등 관련 기관에 직접
          연락하시기 바랍니다.
        </p>
        <p className="g-sub">
          어르신 화면에 표시되는 <strong>「119에 직접 전화하기」는 기기의 전화 기능을 여는 것일 뿐</strong>이며, 본 서비스가
          신고를 대행하거나 구조 요청을 중개하지 않습니다. 통화는 이용자와 119 사이에서 직접 이루어지고 본 서비스는
          통화 내용을 기록하거나 관여하지 않습니다. 이 안내는 위험도 판정 결과와 무관하게 항상 동일하게 표시되며,
          서비스가 응급 여부를 판단해 노출하는 것이 아닙니다.
        </p>
      </section>

      <section className="g-terms-section">
        <h2 className="g-terms-heading">3. 개인정보 수집·이용</h2>
        <p className="g-sub">
          가입 시 이름·이메일 등 일반 개인정보를 수집합니다. 어르신의 지병 등 건강에 관한 정보는 개인정보보호법상
          민감정보로, 일반 개인정보와 별도로 동의를 받습니다.
        </p>
        <p className="g-sub">
          {/* 예전에는 "음성 안부와 영상편지"가 Gemini로 간다고 적혀 있었는데, 영상은 보내지 않는다.
              실제로 하지 않는 처리를 동의받으면 동의 범위가 실제보다 넓어진다. */}
          <strong>AI로 보내는 것</strong>: 음성 안부 파일과, 안부 질문·주제를 만들기 위한 지병·최근 안부 응답이 Google
          Gemini API(Google LLC, 국외)로 전송됩니다. 이는 별도로 동의를 받습니다.{" "}
          <strong>영상편지는 어떤 AI 분석도 하지 않으며 외부로 전송되지 않습니다.</strong>
        </p>
        <p className="g-sub">
          <strong>보관 기간</strong>: 영상편지 파일은 발신 후 {RETENTION.LETTER_DAYS}일, 음성 안부 파일은 녹음 후{" "}
          {RETENTION.VOICE_AUDIO_DAYS}일이 지나면 자동으로 삭제됩니다. 음성 파일이 삭제된 뒤에도 AI가 받아쓴 내용과
          소견은 안부 기록으로 남으며, 회원 탈퇴 시 모두 삭제됩니다.
        </p>
      </section>

      <section className="g-terms-section">
        <h2 className="g-terms-heading">4. 녹화/녹음 시 유의사항</h2>
        <p className="g-sub">
          영상편지·말하기 안부를 녹화·녹음할 때는 본인의 음성과 모습만 담아주세요. 타인의 동의 없이 촬영·녹음할 경우
          법적 책임을 질 수 있습니다.
        </p>
      </section>

      <section className="g-terms-section">
        <h2 className="g-terms-heading">5. 보호자의 대리 입력 책임</h2>
        <p className="g-sub">
          보호자가 어르신을 대신하여 지병 등 정보를 입력하는 경우, 어르신(정보주체) 본인의 사전 동의를 받았음을
          전제로 합니다.
        </p>
      </section>

      <p className="g-legal">
        본 약관은 팀이 정한 서비스 운영 방침을 안내하는 것으로, 정식 법률 자문을 대체하지 않습니다.
      </p>
    </AppShell>
  );
}
