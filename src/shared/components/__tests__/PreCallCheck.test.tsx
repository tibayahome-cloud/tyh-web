import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreCallCheck } from "../PreCallCheck";

const fakeStream = () => {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }, { stop }],
    getVideoTracks: () => [{}],
    getAudioTracks: () => [{}]
  } as unknown as MediaStream;
  return { stream, stop };
};

const setMediaDevices = (getUserMedia: unknown) =>
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });

afterEach(() => {
  Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
});

describe("PreCallCheck", () => {
  it("asks first, then offers Join now once the devices work, and releases them before joining", async () => {
    const { stream, stop } = fakeStream();
    setMediaDevices(vi.fn().mockResolvedValue(stream));
    const onJoin = vi.fn();
    render(<PreCallCheck inAppBrowser={false} onJoin={onJoin} onCancel={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Join now" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow camera and microphone" }));

    const join = await screen.findByRole("button", { name: "Join now" });
    expect(screen.getByText("Camera works")).toBeInTheDocument();
    expect(screen.getByText("Microphone works")).toBeInTheDocument();
    fireEvent.click(join);
    expect(stop).toHaveBeenCalled();
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("explains a blocked permission and still lets the person join without a camera", async () => {
    setMediaDevices(vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" })));
    const onJoin = vi.fn();
    render(<PreCallCheck inAppBrowser={false} onJoin={onJoin} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Allow camera and microphone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/lock icon/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Join without camera" }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("tells an in-app browser user to switch browsers", async () => {
    setMediaDevices(vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" })));
    render(<PreCallCheck inAppBrowser onJoin={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Allow camera and microphone" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Chrome or Safari/));
  });

  it("handles a browser with no media support", async () => {
    render(<PreCallCheck inAppBrowser={false} onJoin={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Allow camera and microphone" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("lets the person back out", () => {
    const onCancel = vi.fn();
    render(<PreCallCheck inAppBrowser={false} onJoin={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
