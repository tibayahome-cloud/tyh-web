import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { friendlyJoinError, friendlyMediaError, isInAppBrowser, waitingMessage } from "../callJoin";

describe("isInAppBrowser", () => {
  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Mobile/15E148 Instagram 320.0",
    "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A; wv) AppleWebKit Chrome/120 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]",
    "WhatsApp/2.23 A"
  ])("recognises %s", (ua) => expect(isInAppBrowser(ua)).toBe(true));

  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    "",
    undefined
  ])("leaves an ordinary browser alone: %s", (ua) => expect(isInAppBrowser(ua)).toBe(false));
});

describe("friendlyJoinError", () => {
  it("keeps a server message that already explains itself", () => {
    const error = new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      statusText: "",
      headers: {},
      config: {},
      data: { error: { message: "The call opens 10 minutes before your appointment." } }
    } as never);
    expect(friendlyJoinError(error)).toBe("The call opens 10 minutes before your appointment.");
  });

  it("says what to do when the call script cannot load", () => {
    expect(friendlyJoinError(new Error("Failed to load the video call script"))).toMatch(/Check your internet connection/);
  });

  it("points at the browser settings when the camera or microphone is refused", () => {
    expect(friendlyJoinError(new Error("NotAllowedError: Permission denied"))).toMatch(/camera and microphone/);
  });

  it("never leaves a bare technical message", () => {
    expect(friendlyJoinError(new Error("TypeError: x is undefined"))).toMatch(/try again/);
    expect(friendlyJoinError("weird")).toMatch(/try again/);
  });
});

describe("friendlyMediaError", () => {
  const named = (name: string) => Object.assign(new Error("x"), { name });

  it("explains a blocked camera and points at the lock icon", () => {
    expect(friendlyMediaError(named("NotAllowedError"))).toMatch(/lock icon/i);
  });

  it("tells an in-app browser user to open Chrome or Safari", () => {
    expect(friendlyMediaError(named("NotAllowedError"), true)).toMatch(/Chrome or Safari/);
  });

  it("covers a missing device and a device in use", () => {
    expect(friendlyMediaError(named("NotFoundError"))).toMatch(/could not find/i);
    expect(friendlyMediaError(named("NotReadableError"))).toMatch(/another app/i);
  });

  it("falls back to a next step for anything else", () => {
    expect(friendlyMediaError(new Error("boom"))).toMatch(/browser settings/i);
    expect(friendlyMediaError(undefined)).toMatch(/try again/i);
  });
});

describe("waitingMessage", () => {
  it("names the other person by role", () => {
    expect(waitingMessage("provider")).toMatch(/client/);
    expect(waitingMessage("client")).toMatch(/your doctor/);
    expect(waitingMessage(null)).toMatch(/your doctor/);
  });
});
