// 초대 링크를 최초 개봉한 기기를 구분하기 위한 소프트 기기 식별자.
// 하드웨어 지문이 아니라 localStorage 기반 마커임 — 사이트 데이터를 지우면 새 기기로 인식된다.
// 근거: docs/기능설계서.md §2.5
const KEY = "callog.deviceId";

export function getDeviceId(): string {
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
