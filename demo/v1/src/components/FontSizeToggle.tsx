import { useEffect, useState } from "react";

const KEY = "callog.fontScale";
const SCALES = [1, 1.15, 1.3];

// 기능설계서 §1 접근성: 글씨 크기 확대 가능 기능
export function FontSizeToggle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(KEY) ?? "0");
    setIndex(saved);
    document.documentElement.style.setProperty("--font-scale", String(SCALES[saved] ?? 1));
  }, []);

  function cycle() {
    const next = (index + 1) % SCALES.length;
    setIndex(next);
    window.localStorage.setItem(KEY, String(next));
    document.documentElement.style.setProperty("--font-scale", String(SCALES[next]));
  }

  return (
    <button type="button" className="e-speak" onClick={cycle}>
      가+ 글씨 크게
    </button>
  );
}
