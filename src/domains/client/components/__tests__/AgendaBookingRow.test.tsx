import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgendaBookingRow } from "../AgendaBookingRow";
import type { AgendaDay } from "../../utils/agendaDates";

const DAY: AgendaDay = { key: "2026-Oct-22", weekday: "Thu", day: "22", month: "Oct", year: "2026", time: "13:52", soon: false };

const booking = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "b1",
    isTelemedicine: true,
    status: "scheduled",
    estimateDurationMinutes: 30,
    addressText: null,
    service: { name: "General consultation" },
    provider: { fullName: "Dr Example", avatarUrl: null },
    ...overrides
  }) as never;

const renderRow = (props: Record<string, unknown> = {}, bookingOverrides: Record<string, unknown> = {}) =>
  render(
    <ul>
      <AgendaBookingRow booking={booking(bookingOverrides)} day={DAY} showDate onOpen={vi.fn()} {...props} />
    </ul>
  );

describe("AgendaBookingRow", () => {
  it("shows the date on the rail and the time, length, kind, state and doctor", () => {
    renderRow();

    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByText(/13:52/)).toBeInTheDocument();
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
    expect(screen.getByText("Telemedicine")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Dr Example")).toBeInTheDocument();
  });

  it("hides the rail from screen readers when it repeats the previous row's day", () => {
    const { container } = renderRow({ showDate: false });

    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("opens the booking from the service name", () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.click(screen.getByRole("button", { name: "General consultation" }));

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows a place only for a home based booking, and never a 'not specified' line", () => {
    const { unmount } = renderRow({}, { isTelemedicine: false, addressText: "Kilimani, Nairobi" });
    expect(screen.getByText("Home based")).toBeInTheDocument();
    expect(screen.getByText("Kilimani, Nairobi")).toBeInTheDocument();
    unmount();

    renderRow({}, { isTelemedicine: true, addressText: "Kilimani, Nairobi" });
    expect(screen.queryByText("Kilimani, Nairobi")).not.toBeInTheDocument();
    expect(screen.queryByText(/not specified/i)).not.toBeInTheDocument();
  });

  it("says a doctor or a provider is being found, by kind", () => {
    const { unmount } = renderRow({}, { provider: null });
    expect(screen.getByText("Finding a doctor...")).toBeInTheDocument();
    unmount();

    renderRow({}, { provider: null, isTelemedicine: false });
    expect(screen.getByText("Finding a provider...")).toBeInTheDocument();
  });

  it("says Soon for a booking with no appointment time yet, and shows no time", () => {
    renderRow({ day: { key: "soon", weekday: "Soon", day: "", month: "", year: "", time: "", soon: true } });

    expect(screen.getByText("Soon")).toBeInTheDocument();
    expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
  });

  it("offers Rate where it is given, separately from opening the booking", () => {
    const onRate = vi.fn();
    const onOpen = vi.fn();
    renderRow({ onRate, onOpen });

    fireEvent.click(screen.getByRole("button", { name: "Rate" }));

    expect(onRate).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
