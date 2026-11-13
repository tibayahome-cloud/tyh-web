import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const siteKey = (): string | undefined => (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || undefined;

/** True when the bot check is switched on for this build. The API enforces it only when its own secret is set. */
export const isBotCheckOn = (): boolean => Boolean(siteKey());

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

export type TurnstileHandle = {
  /** A token works once. Call this after every attempt that used it, so the visitor gets a fresh check for the next one. */
  reset: () => void;
};

/**
 * A small "are you a person" check, shown only when a site key is set. Gives the token to `onToken` (null when it expires,
 * fails or is reset). Keep it mounted for as long as the person might ask again: it is what makes the next token.
 */
export const TurnstileCheck = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void }>(({ onToken }, ref) => {
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widget.current) widget.current.api.reset(widget.current.id);
      onToken(null);
    }
  }));

  useEffect(() => {
    const key = siteKey();
    if (!key || !holder.current) return;
    let cancelled = false;
    loadScript()
      .then((turnstile) => {
        if (cancelled || !holder.current) return;
        const id = turnstile.render(holder.current, {
          sitekey: key,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null)
        });
        widget.current = { api: turnstile, id };
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widget.current) {
        widget.current.api.remove(widget.current.id);
        widget.current = null;
      }
    };
  }, [onToken]);

  if (!siteKey()) return null;
  return <div ref={holder} className="min-h-[65px]" aria-label="Check that you are a person" />;
});
TurnstileCheck.displayName = "TurnstileCheck";
