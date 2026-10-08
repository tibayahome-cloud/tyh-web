import { useEffect, useState, type RefObject } from "react";

// True once the element has entered the viewport (and stays true). Lets a long list defer
// per-row requests until a row is actually on screen. Where IntersectionObserver is missing
// (older browsers, tests), the element counts as visible straight away.
export const useOnceVisible = (ref: RefObject<Element | null>): boolean => {
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, visible]);
  return visible;
};
