import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { DisplaySettings } from "../components/DisplaySettings";
import { SpeakButton } from "../components/SpeakButton";
import { createTestBlob, startRecording, type RecordingHandle } from "../lib/recorder";
import { uploadToBucket, deleteFromBucket } from "../lib/storage";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { RecordingNotice } from "../components/RecordingNotice";

export const SCREEN_ID = "eSpeech";

// 매번 같은 질문만 나오면 심심하니 주제를 여러 개 두고 무작위로 골라 던져준다.
// 근거: 실사용 피드백 — "음성 녹음할 때 주제를 던져주면 좋을 것 같다"
const TOPICS = [
  "가족에게 한마디 해주세요",
  "오늘 하루는 어떠셨어요? 편하게 말씀해주세요",
  "요즘 있었던 즐거운 일을 이야기해주세요",
  "오늘 드신 음식 중에 뭐가 제일 맛있었어요?",
  "요즘 몸은 좀 어떠신지 말씀해주세요",
  "옛날 이야기 하나 들려주세요",
];

export default function ESpeech() {
  const navigate = useNavigate();
  const [topic] = useState(() => TOPICS[Math.floor(Math.random() * TOPICS.length)]);
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
      if (checkin?.id) {
        // daily_checkin_id는 unique 제약이라 하루에 여러 번 녹음하면 insert가 아니라
        // 기존 행을 덮어써야 한다 — 예전엔 insert만 해서 두 번째 시도부터는 조용히
        // 실패하고 항상 첫 녹음만 남아있었다. 근거: 실사용 피드백 — "덮어쓰기가 안 된다"
        const { data: existing } = await supabase
          .from("voice_response")
          .select("audio_url")
          .eq("daily_checkin_id", checkin.id)
          .maybeSingle();
        const { data: voiceRow } = await supabase
          .from("voice_response")
          .upsert(
            {
              daily_checkin_id: checkin.id,
              audio_url: path,
              response_latency_ms: Date.now() - startedAt,
              analysis_status: "pending",
              transcript: null,
              observations: null,
              speech_rate: null,
              silence_ratio: null,
              analysis_json: null,
              // upsert의 ON CONFLICT DO UPDATE는 payload에 없는 컬럼은 건드리지 않는다 —
              // created_at의 default now()는 최초 insert에만 적용되므로 재녹음 시에도
              // "최근 말하기 안부" 시각이 갱신되려면 여기서 직접 채워야 한다.
              created_at: new Date().toISOString(),
            },
            { onConflict: "daily_checkin_id" }
          )
          .select("id")
          .single();
        if (existing?.audio_url) await deleteFromBucket("voice", existing.audio_url).catch(() => {});
        // 분석 요청은 fire-and-forget — 실패해도 하루 기록은 그대로 인정된다
        if (voiceRow?.id) {
          fetch("/api/analyze-voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voiceResponseId: voiceRow.id }),
          }).catch(() => {});
        }
      }
    }
    navigate("/elder/done");
  }

  function skip() {
    navigate("/elder/done");
  }

  return (
    <AppShell variant="elder">
      <button className="e-back" onClick={() => navigate(-1)}>
        ← 이전 화면
      </button>
      <div className="e-topbar">
        <SpeakButton text={topic} />
        <DisplaySettings />
        <span className="e-brand">마지막</span>
      </div>
      <h1 className="e-question">{topic}</h1>
      <p className="e-lead">천천히 말씀하시면 됩니다</p>
      <RecordingNotice />

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
