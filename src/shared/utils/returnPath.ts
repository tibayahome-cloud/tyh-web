/**
 * Where a person was heading before they were asked to sign in or sign up.
 *
 * The landing page's "Talk to a Doctor Online" used to send a signed-out visitor to the sign-in page and forget why
 * they came; after signing in they landed on Home and had to find the way back. The destination now travels with
 * them, as `?next=/app/telemedicine?book=1` in the address or as the `from` the route guard passes along.
 *
 * Only paths on this site are accepted. A crafted link such as `?next=https://elsewhere.example` or `?next=//elsewhere`
 * is ignored, so signing in can never send someone to another site.
 */

const AUTH_PAGES = /^\/(login|signup|forgot-password|reset-password|two-factor|session-expired|legal\/consent|facility\/login|admin\/login)(?:[/?#]|$)/u;

export const TELEMEDICINE_BOOKING_PATH = "/app/telemedicine?book=1";

export const safeReturnPath = (raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  // Same-site paths only: one leading slash, not "//host", not "/\host", no line breaks.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || /[\r\n]/u.test(value)) {
    return null;
  }
  // Never back into the pages that ask for credentials: that would be a loop.
  if (AUTH_PAGES.test(value)) {
    return null;
  }
  return value;
};

type LocationLike = { search: string; state?: unknown };

/** The destination carried in `?next=` or in the router state's `from`, if it is a safe path on this site. */
export const returnPathFrom = (location: LocationLike): string | null => {
  const fromQuery = safeReturnPath(new URLSearchParams(location.search).get("next"));
  if (fromQuery) {
    return fromQuery;
  }
  const state = location.state as { from?: { pathname?: unknown; search?: unknown } } | null | undefined;
  const from = state?.from;
  if (from && typeof from.pathname === "string") {
    return safeReturnPath(`${from.pathname}${typeof from.search === "string" ? from.search : ""}`);
  }
  return null;
};

/** `/signup` or `/signup?next=%2Fapp%2Ftelemedicine%3Fbook%3D1`. */
export const withReturnPath = (target: string, next: string | null | undefined): string =>
  next ? `${target}?next=${encodeURIComponent(next)}` : target;
