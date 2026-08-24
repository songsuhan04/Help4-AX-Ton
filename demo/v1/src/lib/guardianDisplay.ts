// 보호자가 고른 화면 설정(바탕 + 글씨 크기)을 저장하고 문서에 적용한다.
// 어르신 화면의 화면 설정(elderDisplay.ts)과 같은 이유로 보호자 화면에도 둔다 —
// 잘 보이는 화면은 사람마다 다르다. 근거: 실사용 피드백.

const THEME_KEY = "callog.guardianTheme";
const SCALE_KEY = "callog.guardianFontScale";

export type GuardianTheme = "dark" | "light" | "warm" | "maxcontrast";

export interface GuardianThemeOption {
  id: GuardianTheme;
  label: string;
  sample: { bg: string; fg: string; ring: string };
}

export const GUARDIAN_THEME_OPTIONS: GuardianThemeOption[] = [
  { id: "dark", label: "다크", sample: { bg: "#121416", fg: "#F4F5F8", ring: "#6865D8" } },
  { id: "light", label: "라이트", sample: { bg: "#F7F8FB", fg: "#111318", ring: "#2A37B8" } },
  { id: "warm", label: "노을", sample: { bg: "#1B1512", fg: "#FFF6EE", ring: "#E8A33C" } },
  { id: "maxcontrast", label: "또렷하게", sample: { bg: "#000000", fg: "#FFD400", ring: "#FFD400" } },
];

/** styles/guardian.css의 화면 설정 계산에 쓰는 것과 같은 --font-scale 단계 */
export const GUARDIAN_SCALES = [1, 1.15, 1.3] as const;
export const GUARDIAN_SCALE_LABELS = ["보통", "크게", "아주 크게"] as const;

export function getStoredGuardianTheme(): GuardianTheme {
  const saved = window.localStorage.getItem(THEME_KEY);
  return GUARDIAN_THEME_OPTIONS.some((o) => o.id === saved) ? (saved as GuardianTheme) : "dark";
}

export function getStoredGuardianScaleIndex(): number {
  const saved = Number(window.localStorage.getItem(SCALE_KEY) ?? "0");
  return Number.isInteger(saved) && saved >= 0 && saved < GUARDIAN_SCALES.length ? saved : 0;
}

export function applyGuardianTheme(theme: GuardianTheme): void {
  // "다크"는 :root의 기본값이라 속성을 아예 붙이지 않는다
  if (theme === "dark") document.documentElement.removeAttribute("data-guardian-theme");
  else document.documentElement.setAttribute("data-guardian-theme", theme);
  window.localStorage.setItem(THEME_KEY, theme);
}

export function applyGuardianScaleIndex(index: number): void {
  document.documentElement.style.setProperty("--font-scale", String(GUARDIAN_SCALES[index] ?? 1));
  window.localStorage.setItem(SCALE_KEY, String(index));
}

/** 보호자 화면에 들어올 때 저장된 설정을 복원한다 */
export function restoreGuardianDisplay(): void {
  applyGuardianTheme(getStoredGuardianTheme());
  applyGuardianScaleIndex(getStoredGuardianScaleIndex());
}

/** 어르신 화면은 보호자가 고른 바탕/글씨 크기를 따라가지 않는다 */
export function clearGuardianDisplay(): void {
  document.documentElement.removeAttribute("data-guardian-theme");
  document.documentElement.style.removeProperty("--font-scale");
}
