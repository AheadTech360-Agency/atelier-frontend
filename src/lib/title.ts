import { useEffect } from "react";

/** Names the browser tab after the page, so tabs, history and screen readers say where you are. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Atelier` : "Atelier";
  }, [title]);
}
