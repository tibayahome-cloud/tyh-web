import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TelemedicineCallPanel from "../TelemedicineCallPanel";

const hooks = vi.hoisted(() => ({
  confirmJoinMutate: vi.fn(),
  endSessionMutateAsync: vi.fn(),
  joinSessionMutateAsync: vi.fn()
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { fullName: "Demo Client" }
  })
}));

vi.mock("../../hooks/useTelemedicine", () => ({
  useConfirmSessionJoinMutation: () => ({
    mutate: hooks.confirmJoinMutate
  }),
  useEndSessionMutation: () => ({
    mutateAsync: hooks.endSessionMutateAsync
  }),
  useJoinSessionMutation: () => ({
    mutateAsync: hooks.joinSessionMutateAsync
  })
}));

type JitsiListener = (...args: unknown[]) => void;

class FakeJitsiMeetExternalAPI {
  static instances: FakeJitsiMeetExternalAPI[] = [];

  domain: string;
  options: Record<string, unknown>;
  listeners: Record<string, JitsiListener[]> = {};
  dispose = vi.fn();
  participants = 1;

  constructor(domain: string, options: Record<string, unknown>) {
    this.domain = domain;
    this.options = options;
    FakeJitsiMeetExternalAPI.instances.push(this);
  }

  addEventListener(event: string, listener: JitsiListener) {
    this.listeners[event] = [...(this.listeners[event] ?? []), listener];
  }

  getNumberOfParticipants() {
    return this.participants;
  }

  emit(event: string) {
    for (const listener of this.listeners[event] ?? []) {
      listener();
    }
  }
}

// The call now starts after a camera and microphone check, so every test goes through that step first.
const renderCall = async (ui: React.ReactElement) => {
  const view = render(ui);
  fireEvent.click(screen.getByRole("button", { name: "Allow camera and microphone" }));
  fireEvent.click(await screen.findByRole("button", { name: "Join now" }));
  return view;
};

const joinPayload = (role: "client" | "provider" = "client") => ({
  sessionId: "session-1",
  roomName: "opaque-room",
  domain: "meet.localhost",
  token: "jwt",
  expiresAt: "2026-08-11T13:00:00.000Z",
  role,
  isModerator: role === "provider",
  status: "scheduled"
});

describe("TelemedicineCallPanel", () => {
  beforeEach(() => {
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [track],
          getVideoTracks: () => [track],
          getAudioTracks: () => [track]
        })
      }
    });
    FakeJitsiMeetExternalAPI.instances = [];
    hooks.confirmJoinMutate.mockReset();
    hooks.endSessionMutateAsync.mockReset();
    hooks.joinSessionMutateAsync.mockReset();
    hooks.joinSessionMutateAsync.mockResolvedValue(joinPayload());
    hooks.endSessionMutateAsync.mockResolvedValue({
      sessionId: "session-1",
      status: "ended",
      endedAt: "2026-08-11T13:30:00.000Z"
    });

    Object.defineProperty(window, "JitsiMeetExternalAPI", {
      configurable: true,
      value: FakeJitsiMeetExternalAPI
    });
  });

  it("keeps Jitsi leave events local so a dropped call can be rejoined", async () => {
    const onLeave = vi.fn();
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={onLeave} />);

    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));

    act(() => {
      FakeJitsiMeetExternalAPI.instances[0].emit("videoConferenceLeft");
      FakeJitsiMeetExternalAPI.instances[0].emit("readyToClose");
    });

    expect(hooks.endSessionMutateAsync).not.toHaveBeenCalled();
    expect(FakeJitsiMeetExternalAPI.instances[0].dispose).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("applies TYH branding overrides to the Jitsi iframe", async () => {
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);

    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));

    expect(FakeJitsiMeetExternalAPI.instances[0].options).toEqual(
      expect.objectContaining({
        interfaceConfigOverwrite: expect.objectContaining({
          APP_NAME: "Tiba Ya Home",
          SHOW_BRAND_WATERMARK: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false
        })
      })
    );
  });

  it("only shows final consultation completion to providers", async () => {
    const onLeave = vi.fn();
    hooks.joinSessionMutateAsync.mockResolvedValue(joinPayload("provider"));
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={onLeave} />);

    const endButton = await screen.findByRole("button", { name: /end consultation/i });
    fireEvent.click(endButton);
    // Ending it ends it for the client too, so it asks first.
    expect(hooks.endSessionMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "End for everyone" }));

    await waitFor(() => expect(hooks.endSessionMutateAsync).toHaveBeenCalledWith("booking-1"));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("does not show final consultation completion to clients", async () => {
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);

    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));

    expect(screen.queryByRole("button", { name: /end consultation/i })).not.toBeInTheDocument();
  });

  it("offers a reconnect action on a failed join instead of only closing", async () => {
    hooks.joinSessionMutateAsync.mockReset();
    hooks.joinSessionMutateAsync.mockRejectedValueOnce(new Error("Network error"));
    hooks.joinSessionMutateAsync.mockResolvedValueOnce(joinPayload());

    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);

    const reconnectButton = await screen.findByRole("button", { name: "Reconnect" });
    // A bare "Network error" tells nobody what to do; the message says.
    expect(screen.getByText(/Check your internet connection, then try again/)).toBeInTheDocument();

    fireEvent.click(reconnectButton);

    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));
    expect(hooks.joinSessionMutateAsync).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Check your internet connection, then try again/)).not.toBeInTheDocument();
  });

  it("switches off the 'open in the app' page so a phone browser shows the call", async () => {
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);
    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));

    expect(FakeJitsiMeetExternalAPI.instances[0].options).toEqual(
      expect.objectContaining({ configOverwrite: expect.objectContaining({ disableDeepLinking: true }) })
    );
  });

  it("asks before ending the consultation, and 'Keep going' leaves it running", async () => {
    hooks.joinSessionMutateAsync.mockResolvedValue(joinPayload("provider"));
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /end consultation/i }));
    expect(screen.getByRole("alertdialog", { name: "End the consultation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(hooks.endSessionMutateAsync).not.toHaveBeenCalled();
  });

  it("tells someone in another app's browser to open the page in Chrome or Safari", async () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone) Instagram 300.0" });
    try {
      await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);
      expect(await screen.findByText(/open this page in Chrome or Safari/i)).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "userAgent", { configurable: true, value: original });
    }
  });

  it("does not show that notice in an ordinary browser", async () => {
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);
    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));
    expect(screen.queryByText(/open this page in Chrome or Safari/i)).not.toBeInTheDocument();
  });

  it("keeps the screen awake during the call and lets go when it ends", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    try {
      const { unmount } = await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);
      await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
      await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));

      unmount();
      await waitFor(() => expect(release).toHaveBeenCalled());
    } finally {
      Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
    }
  });
  it("does not start the call until the person taps Join now", async () => {
    render(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);
    expect(screen.getByText("Before you join")).toBeInTheDocument();
    expect(hooks.joinSessionMutateAsync).not.toHaveBeenCalled();
    expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(0);
  });

  it("says who it is waiting for while alone, and stops once they arrive", async () => {
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);
    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));
    const api = FakeJitsiMeetExternalAPI.instances[0];
    act(() => api.emit("videoConferenceJoined"));
    expect(await screen.findByText(/Waiting for your doctor to join/i)).toBeInTheDocument();

    api.participants = 2;
    act(() => api.emit("participantJoined"));
    await waitFor(() => expect(screen.queryByText(/Waiting for your doctor/i)).not.toBeInTheDocument());
  });

  it("tells a provider they are waiting for the client", async () => {
    hooks.joinSessionMutateAsync.mockResolvedValue(joinPayload("provider"));
    await renderCall(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);
    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));
    act(() => FakeJitsiMeetExternalAPI.instances[0].emit("videoConferenceJoined"));
    expect(await screen.findByText(/Waiting for the client to join/i)).toBeInTheDocument();
  });
});
