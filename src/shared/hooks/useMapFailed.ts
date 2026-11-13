import { useEffect, useState } from "react";

/**
 * True once the Google map cannot be used: Google calls `gm_authFailure` for a key it refuses (billing off, site not
 * allowed), Google also draws an error panel inside the map for some refusals, and a map that has not drawn after ten seconds counts too. Screens use it to carry on without the map.
 * Pass `watching` as true once a map is on the screen.
 */
export const useMapFailed = (watching: boolean): boolean => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    const previous = w.gm_authFailure;
    w.gm_authFailure = () => {
      setFailed(true);
      previous?.();
    };
    return () => {
      w.gm_authFailure = previous;
    };
  }, []);

  useEffect(() => {
    if (!watching || failed) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      // Google draws its own error panel inside the map when it refuses the key; a map with no drawing at all after ten
      // seconds is also treated as failed.
      const refused =
        document.querySelector(".gm-err-container, .gm-err-title, .dismissButton") ||
        // Google's own box over a map it will not serve properly: "This page can't load Google Maps correctly."
        Array.from(document.querySelectorAll(".gm-style div")).some(
          (el) => el.children.length < 6 && /can.t load Google Maps correctly/i.test(el.textContent ?? "")
        );
      const notDrawn = Date.now() - startedAt > 10000 && !document.querySelector(".gm-style");
      if (refused || notDrawn) setFailed(true);
    }, 500);
    return () => window.clearInterval(timer);
  }, [watching, failed]);

  return failed;
};
