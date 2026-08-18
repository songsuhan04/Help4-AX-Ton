// MediaRecorder 래퍼 — 음성(eSpeech)·영상(eRecord/gLetter) 녹화 공용.
// iOS Safari는 webm을 지원하지 않으므로 mp4로 폴백한다.
export function pickMimeType(kind: "audio" | "video"): string {
  const candidates =
    kind === "audio"
      ? ["audio/webm", "audio/mp4"]
      : ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
      return type;
    }
  }
  return candidates[candidates.length - 1];
}

export interface RecordingHandle {
  stop: () => Promise<Blob>;
  stream: MediaStream;
}

export async function startRecording(kind: "audio" | "video"): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia(
    kind === "audio" ? { audio: true } : { audio: true, video: true }
  );
  const mimeType = pickMimeType(kind);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
  recorder.start();
  return {
    stream,
    stop: async () => {
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      return stopped;
    },
  };
}

// eSpeech/eRecord의 DEV 전용 "테스트 파일 사용" 버튼 — 카메라/마이크 권한 없이 업로드~재생 경로를 검증
export function createTestBlob(kind: "audio" | "video"): Blob {
  const mimeType = kind === "audio" ? "audio/webm" : "video/webm";
  return new Blob([new Uint8Array([0])], { type: mimeType });
}
