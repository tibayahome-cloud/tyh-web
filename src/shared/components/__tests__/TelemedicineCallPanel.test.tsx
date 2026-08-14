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

  constructor(domain: string, options: Record<string, unknown>) {
    this.domain = domain;
    this.options = options;
    FakeJitsiMeetExternalAPI.instances.push(this);
  }

  addEventListener(event: string, listener: JitsiListener) {
    this.listeners[event] = [...(this.listeners[event] ?? []), listener];
  }

  emit(event: string) {
    for (const listener of this.listeners[event] ?? []) {
      listener();
    }
  }
}

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
    render(<TelemedicineCallPanel bookingId="booking-1" onLeave={onLeave} />);

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
    render(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);

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
    render(<TelemedicineCallPanel bookingId="booking-1" onLeave={onLeave} />);

    const endButton = await screen.findByRole("button", { name: /end consultation/i });
    fireEvent.click(endButton);

    await waitFor(() => expect(hooks.endSessionMutateAsync).toHaveBeenCalledWith("booking-1"));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("does not show final consultation completion to clients", async () => {
    render(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);

    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));

    expect(screen.queryByRole("button", { name: /end consultation/i })).not.toBeInTheDocument();
  });

  it("offers a reconnect action on a failed join instead of only closing", async () => {
    hooks.joinSessionMutateAsync.mockReset();
    hooks.joinSessionMutateAsync.mockRejectedValueOnce(new Error("Network error"));
    hooks.joinSessionMutateAsync.mockResolvedValueOnce(joinPayload());

    render(<TelemedicineCallPanel bookingId="booking-1" onLeave={vi.fn()} />);

    const reconnectButton = await screen.findByRole("button", { name: "Reconnect" });
    expect(screen.getByText("Network error")).toBeInTheDocument();

    fireEvent.click(reconnectButton);

    await waitFor(() => expect(FakeJitsiMeetExternalAPI.instances).toHaveLength(1));
    expect(hooks.joinSessionMutateAsync).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Network error")).not.toBeInTheDocument();
  });
});
