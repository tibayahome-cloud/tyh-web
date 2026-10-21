import { isAxiosError } from "axios";

import { getApiError } from "./errors";

// Browsers opened from inside another app (WhatsApp, Instagram, Facebook, SMS link previews, Android
// WebViews) often refuse camera and microphone access without saying why. Detecting them lets the call
// screen say what to do instead of leaving someone staring at a call that cannot start.
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|; wv\)/i;

export const isInAppBrowser = (userAgent: string | null | undefined): boolean =>
  Boolean(userAgent) && IN_APP_BROWSER.test(userAgent as string);

// What went wrong joining a call, in words that say what to do. A server message is kept (it already
// explains things like "the call opens 10 minutes before"); everything else gets a next step.
export const friendlyJoinError = (err: unknown): string => {
  if (isAxiosError(err)) return getApiError(err, "We could not join the call. Try again.");
  const message = err instanceof Error ? err.message : "";
  if (/video call script/i.test(message)) {
    return "We could not load the video call. Check your internet connection and try again.";
  }
  if (/permission|notallowed|denied/i.test(message)) {
    return "Allow the camera and microphone for this site in your browser settings, then try again.";
  }
  return "We could not join the call. Check your internet connection, then try again.";
};

// Why the camera or microphone could not be switched on, with the next step. `name` is the DOMException
// name the browser reports; the in-app browser case is called out because it is the most common cause.
export const friendlyMediaError = (err: unknown, inAppBrowser = false): string => {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return inAppBrowser
      ? "This app is blocking your camera and microphone. Open this page in Chrome or Safari and try again."
      : "Camera or microphone is blocked. Tap the lock icon next to the address, allow both, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "We could not find a camera or microphone on this device. Plug one in or try another device.";
  }
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") {
    return "Another app is using your camera or microphone. Close it, then try again.";
  }
  return "We could not switch on your camera and microphone. Check your browser settings, then try again.";
};

// The line shown while you are the only one in the call. Names the other person by role so a client
// reads "your doctor" and a provider reads "the client".
export const waitingMessage = (role: string | null | undefined): string =>
  role === "provider"
    ? "Waiting for the client to join. Stay on this screen."
    : "Waiting for your doctor to join. Stay on this screen.";
