import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { createTestBlob, startRecording, type RecordingHandle } from "../lib/recorder";
import { uploadToBucket } from "../lib/storage";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eSpeech";

const QUESTION = "가족에게 한마디 해주세요";

export default function ESpeech() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState<RecordingHandle | null>(null);
  const [busy, setBusy] = useState(false);
  const startedAt = useState(() => Date.now())[0];

  async function start() {
    const handle = await startRecording("audio");
    setRecording(handle);
  }

  async function stopAndSave() {
    setBusy(true);
    const blob = recording ? await recording.stop() : createTestBlob("audio");
    setRecording(null);
    await save(blob);
  }

  async function useTestFile() {
    setBusy(true);
    await save(createTestBlob("audio"));
  }

  async function save(blob: Blob) {
    const elderId = getStoredElderProfileId();
    if (supabaseConfigured && elderId) {
      const supabase = getSupabase();
      const path = await uploadToBucket("voice", elderId, blob, "webm");
      const { data: checkin } = await supabase
        .from("daily_checkin")
        .select("id")
        .eq("elder_profile_id", elderId)
        .eq("date", new Date().toISOString().slice(0, 10))
        .single();
      const { data: voiceRow } = await supabase
        .from("voice_response")
        .insert({
          daily_checkin_id: checkin?.id,
          audio_url: path,
          response_latency_ms: Date.now() - startedAt,
        })
        .select("id")
        .single();
      // 분석 요청은 fire-and-forget — 실패해도 하루 기록은 그대로 인정된다
      if (voiceRow?.id) {
        fetch("/api/analyze-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceResponseId: voiceRow.id }),
        }).catch(() => {});
      }
    }
    navigate("/elder/done");
  }

  function skip() {
    navigate("/elder/done");
  }

  return (
    <AppShell variant="elder">
      <button
        className="e-secondary"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 12, width: "auto", padding: "8px 16px" }}
      >
        ← 이전 화면
      </button>
      <div className="e-topbar">
        <span>마지막</span>
        <SpeakButton text={QUESTION} />
      </div>
      <h1 className="e-question">{QUESTION}</h1>
      <p style={{ color: "rgba(255,255,255,0.7)" }}>천천히 말씀하시면 됩니다</p>

      {!recording && (
        <button className="e-primary" onClick={start} disabled={busy}>
          ● 말하기 시작
        </button>
      )}
      {recording && (
        <button className="e-primary" onClick={stopAndSave} disabled={busy}>
          {busy ? "저장 중..." : "말하기 종료"}
        </button>
      )}
      {import.meta.env.DEV && !recording && (
        <button className="e-secondary" onClick={useTestFile} disabled={busy}>
          (개발용) 테스트 파일 사용
        </button>
      )}
      <button className="e-secondary" onClick={skip} disabled={busy}>
        오늘은 건너뛰기
      </button>
    </AppShell>
  );
}
