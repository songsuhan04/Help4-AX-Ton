// 어르신 화면의 "글씨 크게" 배율(components/FontSizeToggle.tsx가 --font-scale로 설정)에
// 맞춰 폰트 크기를 계산한다. 절대 px로 박아둔 값은 --font-scale이 바뀌어도 반응하지
// 않으므로, 어르신 화면의 인라인 fontSize는 반드시 이 헬퍼를 거쳐야 한다.
export function fs(px: number): string {
  return `calc(${px}px * var(--font-scale))`;
}
