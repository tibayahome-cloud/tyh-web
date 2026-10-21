import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VideoConsultationDetails } from "../VideoConsultationDetails";

// 08:00Z is 11:00 in Nairobi.
const NOW = new Date("2026-10-22T08:00:00Z");

const booking = (minutesAway: number, overrides: Record<string, unknown> = {}) =>
  ({
    id: "67bebf02-3cbf-4660-92a9-1a267a635b9a",
    scheduledAt: new Date(NOW.getTime() + minutesAway * 60_000).toISOString(),
    estimateDurationMinutes: 30,
    status: "scheduled",
    addressText: null,
    lat: null,
    lng: null,
    service: { name: "Video consultation", category: { name: "Consultations" } },
    client: { id: "c1", fullName: "Amina Client", phone: "+254700000003", avatarUrl: null },
    ...overrides
  }) as never;

const baseProps = {
  timezone: "Africa/Nairobi",
  joinWindowBeforeMinutes: 10,
  statusLabel: "Scheduled",
  statusClassName: "bg-slate-100",
  unattended: false,
  showPayoutNote: false,
  onBack: vi.fn(),
  onJoin: vi.fn(),
  onChat: vi.fn(),
  reschedule: null,
  notes: null
};

const renderPage = (minutesAway: number, props: Record<string, unknown> = {}, bookingOverrides: Record<string, unknown> = {}) =>
  render(<VideoConsultationDetails {...baseProps} booking={booking(minutesAway, bookingOverrides)} {...props} />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("provider VideoConsultationDetails", () => {
  it("shows when the consultation is: date, time range, timezone and how long to wait", () => {
    renderPage(135);

    expect(screen.getByText(/Thursday.*22|22.*Thursday/)).toBeInTheDocument();
    expect(screen.getByText(/13:15 to 13:45/)).toBeInTheDocument();
    expect(screen.getByText(/Nairobi time/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Starts in 2 h 15 min");
  });

  it("shows the client by name, with a message button, and never their phone number", () => {
    const onChat = vi.fn();
    renderPage(135, { onChat });

    expect(screen.getByText("Amina Client")).toBeInTheDocument();
    expect(screen.queryByText(/\+2547/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /call/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Message/ }));
    expect(onChat).toHaveBeenCalledOnce();
  });

  it("uses no game-style or place wording: no map, route, location or waypoint", () => {
    renderPage(135);

    for (const word of [/tactical/i, /protocol/i, /intelligence/i, /waypoint/i, /vector/i, /location/i, /route/i, /map/i]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument();
    }
  });

  it("keeps the raw id off the page", () => {
    renderPage(135);

    expect(screen.queryByText(/67bebf02/i)).not.toBeInTheDocument();
  });

  it("does not offer Join before the call opens, and says when it opens", () => {
    renderPage(135);

    expect(screen.queryByRole("button", { name: /Join video call/ })).not.toBeInTheDocument();
    expect(screen.getByText(/The call opens at 13:05, 10 minutes before the appointment/)).toBeInTheDocument();
  });

  it("offers a large Join button once the call is open", () => {
    const onJoin = vi.fn();
    renderPage(5, { onJoin });

    fireEvent.click(screen.getByRole("button", { name: /Join video call/ }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("switches to Join as time passes, without a reload", () => {
    renderPage(11);
    expect(screen.queryByRole("button", { name: /Join video call/ })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("button", { name: /Join video call/ })).toBeInTheDocument();
  });

  it("points at suggesting a new time when nobody joined", () => {
    renderPage(-20, { unattended: true });

    expect(screen.getByText(/Nobody joined this consultation. You can suggest a new time below/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Join video call/ })).not.toBeInTheDocument();
  });

  it("says when earnings arrive only where the provider is shown payment", () => {
    const { unmount } = renderPage(135, { showPayoutNote: true });
    expect(screen.getByText(/credited to your wallet/)).toBeInTheDocument();
    unmount();

    renderPage(135, { showPayoutNote: false });
    expect(screen.queryByText(/credited to your wallet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/payout/i)).not.toBeInTheDocument();
  });

  it("renders the reschedule and notes sections the page gives it", () => {
    renderPage(135, { reschedule: <p>reschedule section</p>, notes: <p>notes section</p> });

    expect(screen.getByText("reschedule section")).toBeInTheDocument();
    expect(screen.getByText("notes section")).toBeInTheDocument();
  });
});
