import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VideoConsultationDetails } from "../VideoConsultationDetails";

// 08:00Z is 11:00 in Nairobi.
const NOW = new Date("2026-10-22T08:00:00Z");

const booking = (minutesAway: number, overrides: Record<string, unknown> = {}) =>
  ({
    id: "9255e426-ead8-46a2-a996-85b26b94f17e",
    scheduledAt: new Date(NOW.getTime() + minutesAway * 60_000).toISOString(),
    estimateDurationMinutes: 30,
    status: "scheduled",
    currency: "KES",
    priceCents: 150000,
    addressText: null,
    service: { name: "Video consultation" },
    provider: { id: "p1", fullName: "Dr Example", avatarUrl: null },
    ...overrides
  }) as never;

const baseProps = {
  timezone: "Africa/Nairobi",
  joinWindowBeforeMinutes: 10,
  statusLabel: "Scheduled",
  statusClassName: "bg-slate-100",
  unattended: false,
  onBack: vi.fn(),
  onJoin: vi.fn(),
  onChat: vi.fn(),
  cancel: null,
  reportNoShow: null,
  noShowReported: false,
  reportTechnicalIssue: null,
  reschedule: null,
  paymentNotice: null,
  feedback: null,
  onBackToBookings: vi.fn()
};

const renderPage = (minutesAway: number, props: Record<string, unknown> = {}, bookingOverrides: Record<string, unknown> = {}) =>
  render(<VideoConsultationDetails {...baseProps} booking={booking(minutesAway, bookingOverrides)} {...props} />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("VideoConsultationDetails", () => {
  it("answers when: the date, the time range in the facility's timezone, and how long to wait", () => {
    renderPage(135);

    expect(screen.getByText(/Thursday.*22|22.*Thursday/)).toBeInTheDocument();
    expect(screen.getByText(/13:15 to 13:45/)).toBeInTheDocument();
    expect(screen.getByText(/Nairobi time/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Starts in 2 h 15 min");
  });

  it("shows nothing about a place: no location, address, map or order summary", () => {
    renderPage(135);

    expect(screen.queryByText(/location/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/address/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/order summary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/matching provider/i)).not.toBeInTheDocument();
  });

  it("shows the fee once, not as a price and a total", () => {
    renderPage(135);

    expect(screen.getAllByText(/1,500/)).toHaveLength(1);
  });

  it("keeps the raw id out of the page except as one short reference at the bottom", () => {
    renderPage(135);

    expect(screen.queryByText(/9255e426-ead8/i)).not.toBeInTheDocument();
    expect(screen.getByText("9255E426")).toBeInTheDocument();
  });

  it("says who the doctor is and offers a message", () => {
    const onChat = vi.fn();
    renderPage(135, { onChat });

    expect(screen.getByText("Dr Example")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Message/ }));
    expect(onChat).toHaveBeenCalledOnce();
  });

  it("says a doctor is being found when none is assigned yet, without an empty card", () => {
    renderPage(135, {}, { provider: null, status: "telemedicine_paid_pending_assignment" });

    expect(screen.getByText(/We are finding a doctor for you/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Message/ })).not.toBeInTheDocument();
  });

  it("does not offer Join before the call opens, and says when it opens", () => {
    renderPage(135);

    expect(screen.queryByRole("button", { name: /Join call/ })).not.toBeInTheDocument();
    expect(screen.getByText(/The call opens at 13:05, 10 minutes before your appointment/)).toBeInTheDocument();
  });

  it("offers a large Join button once the call is open", () => {
    const onJoin = vi.fn();
    renderPage(5, { onJoin });

    fireEvent.click(screen.getByRole("button", { name: /Join call/ }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("switches to Join as time passes, without a reload", () => {
    renderPage(11);
    expect(screen.queryByRole("button", { name: /Join call/ })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("button", { name: /Join call/ })).toBeInTheDocument();
  });

  it("tells the person nobody joined, instead of offering Join", () => {
    renderPage(-20, { unattended: true });

    expect(screen.getByText(/Nobody joined this consultation/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Join call/ })).not.toBeInTheDocument();
  });

  it("shows only the actions it is given, with the cancel wording it is given", () => {
    const onCancel = vi.fn();
    renderPage(135, {
      cancel: { label: "Remove unpaid request", onClick: onCancel, loading: false },
      reportTechnicalIssue: vi.fn()
    });

    expect(screen.queryByRole("button", { name: /My doctor did not join/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report a technical problem" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove unpaid request" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows that a missed-call report was received instead of offering it again", () => {
    renderPage(-20, { noShowReported: true });

    expect(screen.getByText(/You reported that your doctor did not join/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /My doctor did not join/ })).not.toBeInTheDocument();
  });

  it("copies the reference", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderPage(135);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("9255E426");
  });
});
