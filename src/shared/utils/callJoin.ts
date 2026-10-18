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
