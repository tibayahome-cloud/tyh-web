import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { useJoinFromLink } from "../useJoinFromLink";

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const booking = (minutes: number, extra = {}) => ({
  id: "b1",
  isTelemedicine: true,
  scheduledAt: minutesFromNow(minutes),
  estimateDurationMinutes: 30,
  ...extra
});

const run = (url: string, bookingValue: ReturnType<typeof booking> | undefined, onJoin: () => void) => {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(
    () => {
      useJoinFromLink(bookingValue, 10, onJoin);
      return useLocation().search;
    },
    { wrapper }
  );
};

describe("useJoinFromLink", () => {
  it("opens the call and removes the parameter when the window is open", async () => {
    const onJoin = vi.fn();
    const { result } = run("/app/bookings/b1?join=1", booking(5), onJoin);

    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
    expect(result.current).toBe("");
  });

  it("does not open a call that is not open yet, but still removes the parameter", async () => {
    const onJoin = vi.fn();
    const { result } = run("/app/bookings/b1?join=1", booking(120), onJoin);

    await waitFor(() => expect(result.current).toBe(""));
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("waits for the booking to load before deciding", async () => {
    const onJoin = vi.fn();
    const { result } = run("/app/bookings/b1?join=1", undefined, onJoin);

    expect(onJoin).not.toHaveBeenCalled();
    expect(result.current).toBe("?join=1");
  });

  it("does nothing without the parameter", () => {
    const onJoin = vi.fn();
    run("/app/bookings/b1", booking(5), onJoin);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("never opens a call for a home visit", async () => {
    const onJoin = vi.fn();
    const { result } = run("/app/bookings/b1?join=1", booking(5, { isTelemedicine: false }), onJoin);

    await waitFor(() => expect(result.current).toBe(""));
    expect(onJoin).not.toHaveBeenCalled();
  });
});
