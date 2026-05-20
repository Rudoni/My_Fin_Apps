import { useEffect, useState } from "react";

export function useIsMobile(query = "(max-width: 900px)") {
  const getMatches = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(query);
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}
