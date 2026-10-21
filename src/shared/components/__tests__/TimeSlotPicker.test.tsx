/**
 * Choosing another time is picking a day and then one of the times that is really open, by mouse or by arrow keys.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const slotsState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../hooks/useTelemedicine", () => ({ useRescheduleSlots: () => slotsState.value }));

import { TimeSlotPicker } from "../TimeSlotPicker";

const data = {
  timezone: "Africa/Nairobi",
  slots: [
    { startAt: "2026-09-10T06:00:00Z", endAt: "2026-09-10T06:30:00Z" },
    { startAt: "2026-09-10T07:00:00Z", endAt: "2026-09-10T07:30:00Z" },
    { startAt: "2026-09-11T06:00:00Z", endAt: "2026-09-11T06:30:00Z" }
  ]
};

const Harness = ({ onPick }: { onPick?: (value: string | null) => void }) => {
  const [value, setValue] = useState<string | null>(null);
  return (
    <TimeSlotPicker
      bookingId="b1"
      value={value}
      onChange={(next) => {
        setValue(next);
        onPick?.(next);
      }}
    />
  );
};

beforeEach(() => {
  slotsState.value = { isPending: false, isError: false, data, refetch: vi.fn() };
});

describe("TimeSlotPicker", () => {
  it("shows the first day's times and the zone they are in", () => {
    render(<Harness />);

    expect(screen.getByRole("radio", { name: /Thursday 10 September, 2 times/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "09:00" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "10:00" })).toBeInTheDocument();
    expect(screen.getByText(/Shown in Nairobi time/)).toBeInTheDocument();
  });

  it("changes the times when another day is chosen, and reports the chosen instant", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    fireEvent.click(screen.getByRole("radio", { name: /Friday 11 September, 1 time/ }));
    fireEvent.click(screen.getByRole("radio", { name: "09:00" }));

    expect(onPick).toHaveBeenLastCalledWith("2026-09-11T06:00:00Z");
    expect(screen.getByText(/Friday 11 September at 09:00/)).toBeInTheDocument();
  });

  it("moves between times with the arrow keys, choosing as it goes", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    fireEvent.click(screen.getByRole("radio", { name: "09:00" }));
    fireEvent.keyDown(screen.getByRole("radio", { name: "09:00" }), { key: "ArrowRight" });

    expect(onPick).toHaveBeenLastCalledWith("2026-09-10T07:00:00Z");
    expect(screen.getByRole("radio", { name: "10:00" })).toBeChecked();
  });

  it("keeps one stop per row for the tab key", () => {
    render(<Harness />);

    const days = screen.getAllByRole("radio", { name: /\d times?$/ });
    expect(days.filter((day) => day.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("explains an empty window instead of showing nothing", () => {
    slotsState.value = { isPending: false, isError: false, data: { timezone: "Africa/Nairobi", slots: [] }, refetch: vi.fn() };
    render(<Harness />);

    expect(screen.getByRole("status")).toHaveTextContent("There are no free times in the next two weeks");
  });

  it("says what failed and offers a retry", () => {
    const refetch = vi.fn();
    slotsState.value = { isPending: false, isError: true, data: undefined, refetch };
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("alert")).toHaveTextContent("could not load");
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a placeholder shaped like the picker while loading", () => {
    slotsState.value = { isPending: true, isError: false, data: undefined, refetch: vi.fn() };
    render(<Harness />);

    expect(screen.getByLabelText("Loading available times")).toHaveAttribute("aria-busy", "true");
  });
});
