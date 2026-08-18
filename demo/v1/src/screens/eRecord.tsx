import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { createTestBlob, startRecording, type RecordingHandle } from "../lib/recorder";
import { uploadToBucket } from "../lib/storage";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eRecord";

export default function ERecord() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState<RecordingHandle | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function start() {
    const handle = await startRecording("video");
    setRecording(handle);
    if (videoRef.current) videoRef.current.srcObject = handle.stream;
  }

  async function stopAndSend() {
    setBusy(true);
    const blob = recording ? await recording.stop() : createTestBlob("video");
    setRecording(null);
    await send(blob);
  }

  async function useTestFile() {
    setBusy(true);
    await send(createTestBlob("video"));
  }

  async function send(blob: Blob) {
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
        unlock_condition: "none",
      });
    }
    navigate("/elder/done");
  }

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <span>영상편지</span>
        <SpeakButton text="하고 싶은 말씀을 하세요" />
      </div>
      <h1 className="e-question" style={{ fontSize: 24 }}>하고 싶은 말씀을 하세요</h1>

      <video ref={videoRef} autoPlay muted style={{ width: "100%", borderRadius: 12, background: "rgba(0,0,0,0.3)", aspectRatio: "4/3", marginBottom: 16 }} />

      {!recording && (
        <>
          <button className="e-primary" onClick={start} disabled={busy}>
            ● 찍기 시작
          </button>
          {import.meta.env.DEV && (
            <button className="e-secondary" onClick={useTestFile} disabled={busy}>
              (개발용) 테스트 파일 사용
            </button>
          )}
        </>
      )}
      {recording && (
        <button className="e-primary" onClick={stopAndSend} disabled={busy}>
          {busy ? "전송 중..." : "찍기 종료 후 보내기"}
        </button>
      )}
      <button className="e-secondary" onClick={() => navigate("/elder/done")}>
        완료 화면으로
      </button>
    </AppShell>
  );
}
