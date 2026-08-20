import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { createTestBlob, startRecording, type RecordingHandle } from "../lib/recorder";
import { uploadToBucket } from "../lib/storage";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eRecord";

// 촬영 → 확인(재생) → 전송 → 완료(확인용 재생) 순서로 진행한다.
// 근거: 실사용 피드백 — "영상을 다 찍고 확인하는 마지막 화면이 있으면 좋겠다"
type Stage = "record" | "preview" | "sent";

export default function ERecord() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("record");
  const [recording, setRecording] = useState<RecordingHandle | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const liveRef = useRef<HTMLVideoElement>(null);
  const previewUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  function setBlobAndPreview(next: Blob) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(next);
    setBlob(next);
    setStage("preview");
  }

  async function start() {
    const handle = await startRecording("video");
    setRecording(handle);
    if (liveRef.current) liveRef.current.srcObject = handle.stream;
  }

  async function stop() {
    const result = recording ? await recording.stop() : createTestBlob("video");
    setRecording(null);
    setBlobAndPreview(result);
  }

  function useTestFile() {
    setBlobAndPreview(createTestBlob("video"));
  }

  function retake() {
    setBlob(null);
    setStage("record");
  }

  async function confirmSend() {
    if (!blob) return;
    setBusy(true);
    const elderId = getStoredElderProfileId();
    if (supabaseConfigured && elderId) {
      const supabase = getSupabase();
      const path = await uploadToBucket("letters", elderId, blob, "webm");
      const { data: elder } = await supabase.from("elder_profile").select("family_account_id").eq("id", elderId).single();
      await supabase.from("video_letter").insert({
        sender_type: "elder",
        sender_id: elderId,
        receiver_type: "family",
        receiver_id: elder?.family_account_id,
        title: "영상편지",
        video_url: path,
      });
    }
    setBusy(false);
    setStage("sent");
  }

  if (stage === "record") {
    return (
      <AppShell variant="elder">
        <div className="e-topbar">
          <span>영상편지</span>
          <SpeakButton text="하고 싶은 말씀을 하세요" />
        </div>
        <h1 className="e-question" style={{ fontSize: 24 }}>하고 싶은 말씀을 하세요</h1>

        <video ref={liveRef} autoPlay muted style={{ width: "100%", borderRadius: 12, background: "rgba(0,0,0,0.3)", aspectRatio: "4/3", marginBottom: 16 }} />

        {!recording && (
          <>
            <button className="e-primary" onClick={start}>
              ● 찍기 시작
            </button>
            {import.meta.env.DEV && (
              <button className="e-secondary" onClick={useTestFile}>
                (개발용) 테스트 파일 사용
              </button>
            )}
          </>
        )}
        {recording && (
          <button className="e-primary" onClick={stop}>
            찍기 종료
          </button>
        )}
        <button className="e-secondary" onClick={() => navigate("/elder/done")}>
          완료 화면으로
        </button>
      </AppShell>
    );
  }

  if (stage === "preview") {
    return (
      <AppShell variant="elder">
        <div className="e-topbar">
          <span>영상편지</span>
        </div>
        <h1 className="e-question" style={{ fontSize: 24 }}>이렇게 보낼까요?</h1>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>다시 찍으시려면 아래 버튼을 눌러주세요</p>

        {previewUrl.current && (
          <video src={previewUrl.current} controls style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "4/3", marginBottom: 16 }} />
        )}

        <button className="e-primary" onClick={confirmSend} disabled={busy}>
          {busy ? "보내는 중..." : "이 영상 보내기"}
        </button>
        <button className="e-secondary" onClick={retake} disabled={busy}>
          다시 찍기
        </button>
      </AppShell>
    );
  }

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <span>영상편지</span>
      </div>
      <h1 className="e-question" style={{ fontSize: 24 }}>영상편지를 보냈어요</h1>

      {previewUrl.current && (
        <video src={previewUrl.current} controls style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "4/3", marginBottom: 16 }} />
      )}

      <button className="e-primary" onClick={() => navigate("/elder/done")}>
        완료 화면으로
      </button>
    </AppShell>
  );
}
