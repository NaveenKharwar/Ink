import { useEffect } from "react";

// The tab title names the screen, never the writer's own words.
export function useDocumentTitle(screen: string) {
  useEffect(() => {
    document.title = screen === "Ink" ? "Ink" : `${screen}, Ink`;
  }, [screen]);
}
