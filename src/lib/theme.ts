import { useState } from "react";

export type Theme = "system" | "light" | "dark";

/** The saved choice. index.html applies it before the first paint, so the page never flashes. */
export function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: Theme) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  try {
    if (t === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", t);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(readTheme);
  return [
    theme,
    (t) => {
      applyTheme(t);
      set(t);
    },
  ];
}
