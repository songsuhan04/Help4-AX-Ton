// 어르신 화면의 글자 배율을 계산한다.
//
// --e-fs = --font-scale(어르신이 고른 "글씨 크기") × --e-zoom(넓은 화면 확대분).
// styles/elder.css의 .app-card--elder가 두 값을 곱해 --e-fs로 내려주므로,
// 어르신 화면의 인라인 fontSize는 반드시 이 헬퍼를 거쳐야 둘 다 반영된다.
// 어르신 화면 밖에서 쓰이면 --e-fs가 없으므로 --font-scale로 물러난다.
export function fs(px: number): string {
  return `calc(${px}px * var(--e-fs, var(--font-scale)))`;
}
