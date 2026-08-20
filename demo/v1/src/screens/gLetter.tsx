import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { createTestBlob, startRecording, type RecordingHandle } from "../lib/recorder";
import { uploadToBucket } from "../lib/storage";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";

export const SCREEN_ID = "gLetter";

const TOPICS = ["이번 주말 계획을 말해주세요", "요즘 있었던 즐거운 일을 알려주세요", "고마웠던 순간을 이야기해주세요"];

export default function GLetter() {
  const { elderId } = useParams<{ elderId: string }>();
  const navigate = useNavigate();
  const [topic] = useState(() => TOPICS[Math.floor(Math.random() * TOPICS.length)]);
  const [title, setTitle] = useState("");
  const [recording, setRecording] = useState<RecordingHandle | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function record() {
    const handle = await startRecording("video");
    setRecording(handle);
    if (videoRef.current) videoRef.current.srcObject = handle.stream;
  }

  async function stop() {
    if (!recording) return;
    const result = await recording.stop();
    setBlob(result);
    setRecording(null);
  }

  async function useTestFile() {
    setBlob(createTestBlob("video"));
  }

  async function send() {
    if (!blob) return;
    setSending(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const path = await uploadToBucket("letters", elderId!, blob, "webm");
      const { error } = await supabase.from("video_letter").insert({
        sender_type: "family",
        sender_id: userData.user?.id,
        receiver_type: "elder",
        receiver_id: elderId,
        title: title || topic,
        video_url: path,
        unlock_condition: "checkin_complete",
      });
      if (error) throw error;
      navigate(`/guardian/elders/${elderId}`);
    } catch (err) {
      setError(getErrorMessage(err, "전송에 실패했습니다"));
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <BackButton />
      <div className="g-header">영상편지</div>
      <h1 className="g-title">{topic}</h1>
      <p className="g-sub">어르신이 오늘 안부를 남기면 완료 화면에서 이 편지가 열립니다.</p>
      {/* 통신비밀보호법/민법(타인 초상권·음성권) 대응 — 근거: Help4/법적문제 피해가기 공략.pdf §5, 체크리스트 4번 */}
      <p style={{ fontSize: 13, color: "var(--ink2)", background: "var(--mist)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
        본인의 음성/모습만 녹화해 주세요. 타인의 동의 없는 촬영은 법적 책임을 질 수 있습니다.
      </p>

      <video ref={videoRef} autoPlay muted style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "4/3" }} />

      {!blob && !recording && (
        <>
          <button className="g-button" onClick={record} disabled={!supabaseConfigured}>
            녹화 시작
          </button>
          {import.meta.env.DEV && (
            <button className="g-button g-button--secondary" onClick={useTestFile}>
              (개발용) 테스트 파일 사용
            </button>
          )}
        </>
      )}
      {recording && (
        <button className="g-button" onClick={stop}>
          녹화 종료
        </button>
      )}
      {blob && (
        <>
          <div className="g-field">
            <label>한 줄 제목</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={topic} />
          </div>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
          <button className="g-button" onClick={send} disabled={sending}>
            {sending ? "전송 중..." : "편지 보내기"}
          </button>
        </>
      )}
    </AppShell>
  );
}
