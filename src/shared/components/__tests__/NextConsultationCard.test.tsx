import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NextConsultationCard } from "../NextConsultationCard";

const NOW = new Date("2026-10-20T09:00:00Z");

const booking = (minutesAway: number) =>
  ({
    id: "b1",
    scheduledAt: new Date(NOW.getTime() + minutesAway * 60_000).toISOString(),
    estimateDurationMinutes: 30,
    service: { name: "Follow-up consultation" }
  }) as never;

const renderCard = (minutesAway: number, props = {}) =>
  render(
    <MemoryRouter>
      <NextConsultationCard
        booking={booking(minutesAway)}
        withName="Dr Example"
        joinTo="/app/bookings/b1?join=1"
        detailsTo="/app/bookings/b1"
        joinWindowBeforeMinutes={10}
        {...props}
      />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("NextConsultationCard", () => {
  it("says who it is with, what it is, and how long to wait", () => {
    renderCard(135);
    expect(screen.getByRole("heading", { name: "Your video consultation with Dr Example" })).toBeInTheDocument();
    expect(screen.getByText(/Follow-up consultation/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Starts in 2 h 15 min");
  });

  it("does not offer Join before the call opens, and says when it will", () => {
    renderCard(135);
    expect(screen.queryByRole("link", { name: "Join video call" })).not.toBeInTheDocument();
    expect(screen.getByText(/The call opens 10 minutes before the start/)).toBeInTheDocument();
  });

  it("offers one large Join button once the call is open, pointing where it was told", () => {
    renderCard(8);
    const join = screen.getByRole("link", { name: "Join video call" });
    expect(join).toHaveAttribute("href", "/app/bookings/b1?join=1");
    expect(join.className).toMatch(/min-h-\[56px\]/);
    expect(screen.queryByText(/The call opens/)).not.toBeInTheDocument();
  });

  it("still offers Join a few minutes after the start", () => {
    renderCard(-5);
    expect(screen.getByRole("link", { name: "Join video call" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Started 5 min ago");
  });

  it("counts down and turns into the Join button without a reload", () => {
    renderCard(12);
    expect(screen.queryByRole("link", { name: "Join video call" })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });

    expect(screen.getByRole("link", { name: "Join video call" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Starts in 8 min");
  });

  it("always offers the booking details", () => {
    renderCard(135);
    expect(screen.getByRole("link", { name: "View booking details" })).toHaveAttribute("href", "/app/bookings/b1");
  });
});
