// 저장된 파일 경로에서 Gemini에 알려줄 오디오 형식을 정한다.
//
// 예전에는 "audio/webm"을 그냥 박아 보냈다. 그런데 녹음 형식은 기기마다 다르다 —
// Chrome/Android는 webm을 만들지만 iOS Safari는 webm을 지원하지 않아 mp4를 만든다.
// 그래서 아이폰에서 녹음하면 mp4 파일을 webm이라고 알려주는 꼴이 됐고, Gemini는 이를
// 제대로 열지 못해 "발화 없음"에 가까운 결과를 돌려줬다. 실제로 말씀을 하셨는데도.
//
// 또 하나: Gemini가 받는 형식 목록에 audio/mp4는 없다. m4a·aac는 있다. mp4 컨테이너에
// 담긴 오디오는 사실상 m4a와 같으므로 m4a로 알려준다.
// 근거: https://ai.google.dev/gemini-api/docs/audio (지원 목록에 webm·m4a·aac 포함, mp4 없음)
const EXTENSION_TO_MIME: Record<string, string> = {
  webm: "audio/webm",
  m4a: "audio/m4a",
  mp4: "audio/m4a", // mp4 컨테이너 오디오 = m4a. audio/mp4는 Gemini가 받지 않는다
  ogg: "audio/ogg",
  mp3: "audio/mp3",
  wav: "audio/wav",
  aac: "audio/aac",
  flac: "audio/flac",
};

/** 확장자를 못 알아보면 webm으로 본다 — 예전에 저장된 파일이 전부 .webm 이름이기 때문 */
export const DEFAULT_AUDIO_MIME = "audio/webm";

export function geminiAudioMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_MIME[ext] ?? DEFAULT_AUDIO_MIME;
}
