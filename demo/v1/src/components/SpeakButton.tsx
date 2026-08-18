import { speak } from "../lib/tts";

// "AI 거부감 해소" 목적의 TTS 읽어주기 버튼 — 모든 어르신 화면에 배치
export function SpeakButton({ text }: { text: string }) {
  return (
    <button type="button" className="e-speak" onClick={() => speak(text)}>
      🔈 읽어주기
    </button>
  );
}
