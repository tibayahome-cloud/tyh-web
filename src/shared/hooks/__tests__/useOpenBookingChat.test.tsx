import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showToast: vi.fn()
}));

vi.mock("../useMessaging", () => ({ useCreateThread: () => ({ mutateAsync: state.mutateAsync }) }));
vi.mock("../../components/ToastProvider", () => ({ useToast: () => ({ showToast: state.showToast }) }));

import { useOpenBookingChat } from "../useOpenBookingChat";

const renderChat = (inboxPath = "/pro/inbox") =>
  renderHook(
    () => {
      const chat = useOpenBookingChat(inboxPath);
      const location = useLocation();
      return { ...chat, path: location.pathname };
    },
    { wrapper: ({ children }) => <MemoryRouter initialEntries={["/pro/bookings"]}>{children}</MemoryRouter> }
  );

beforeEach(() => {
  state.mutateAsync.mockReset();
  state.showToast.mockReset();
});

describe("useOpenBookingChat", () => {
  it("asks for the booking's conversation and goes to it", async () => {
    state.mutateAsync.mockResolvedValue({ id: "t1" });
    const { result } = renderChat();

    await act(async () => {
      await result.current.openBookingChat("b1");
    });

    expect(state.mutateAsync).toHaveBeenCalledWith({ scope: "booking", bookingId: "b1" });
    expect(result.current.path).toBe("/pro/inbox/t1");
  });

  it("uses the inbox of whoever is asking", async () => {
    state.mutateAsync.mockResolvedValue({ id: "t9" });
    const { result } = renderChat("/app/inbox");

    await act(async () => {
      await result.current.openBookingChat("b1");
    });

    expect(result.current.path).toBe("/app/inbox/t9");
  });

  it("says so, and stays put, when the conversation cannot be opened", async () => {
    state.mutateAsync.mockRejectedValue(new Error("network"));
    const { result } = renderChat();

    await act(async () => {
      await result.current.openBookingChat("b1");
    });

    expect(state.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "We could not open the conversation", variant: "error" }));
    expect(result.current.path).toBe("/pro/bookings");
    expect(result.current.openingBookingId).toBeNull();
  });

  it("does nothing without a booking", async () => {
    const { result } = renderChat();

    await act(async () => {
      await result.current.openBookingChat("");
    });

    expect(state.mutateAsync).not.toHaveBeenCalled();
  });
});
