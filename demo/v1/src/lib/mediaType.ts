// MediaRecorder가 실제로 만든 형식에 맞는 확장자를 고른다.
//
// 예전에는 확장자를 "webm"으로 박아 저장했다. 기기마다 녹음 형식이 다른데도 그랬다 —
// iOS Safari는 webm을 지원하지 않아 mp4를 만든다. 그래서 아이폰에서 녹음한 mp4 파일이
// .webm 이름으로 저장되고, 서버는 그 이름을 보고 webm이라고 판단해 Gemini에 넘겼다.
// 어르신이 분명히 말씀하셨는데 인식이 안 되던 원인이다.
//
// blob.type 에는 "audio/webm;codecs=opus" 처럼 매개변수가 붙을 수 있어 앞부분만 본다.
const MIME_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "video/webm": "webm",
  "video/mp4": "mp4",
};

export function extensionForBlob(blob: Blob, fallback: string): string {
  const base = (blob.type || "").split(";")[0].trim().toLowerCase();
  return MIME_TO_EXTENSION[base] ?? fallback;
}
