import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** True when the bot check is switched on for this build. The API enforces it only when its own secret is set. */
export const botCheckConfigured = Boolean(SITE_KEY);

const loadScript = (): Promise<TurnstileApi> =>
  new Promise((resolve, reject) => {
    const ready = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) return ready();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => reject(new Error("The check could not load")), { once: true });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

/** A small "are you a person" check, shown only when a site key is set. Gives the token to `onToken` (null if it expires). */
export const TurnstileCheck = ({ onToken }: { onToken: (token: string | null) => void }) => {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !holder.current) return;
    let widgetId: string | null = null;
    let api: TurnstileApi | null = null;
    let cancelled = false;
    loadScript()
      .then((turnstile) => {
        if (cancelled || !holder.current) return;
        api = turnstile;
        widgetId = turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null)
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (api && widgetId) api.remove(widgetId);
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={holder} className="min-h-[65px]" aria-label="Check that you are a person" />;
};
