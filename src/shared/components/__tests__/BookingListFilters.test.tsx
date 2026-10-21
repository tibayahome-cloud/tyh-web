import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingKindBadge } from "../BookingKindBadge";
import { BookingListFilters, kindToIsTelemedicine } from "../BookingListFilters";

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" }
] as const;

const renderFilters = (props: Partial<React.ComponentProps<typeof BookingListFilters<"all" | "pending" | "completed">>> = {}) => {
  const handlers = { onStatusChange: vi.fn(), onKindChange: vi.fn(), onReset: vi.fn() };
  render(
    <BookingListFilters
      statusTabs={TABS}
      status="all"
      kind="all"
      defaultStatus="all"
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

describe("BookingListFilters", () => {
  it("puts every filter in one group: the status tabs and the type choice", () => {
    renderFilters();

    const group = screen.getByRole("group", { name: "Filter bookings" });
    expect(group).toContainElement(screen.getByRole("tablist", { name: "Booking status" }));
    expect(group).toContainElement(screen.getByRole("group", { name: "Booking type" }));
  });

  it("shows no type choice when a list does not use one: the status tabs are the only filter", () => {
    render(
      <BookingListFilters statusTabs={TABS} status="all" defaultStatus="all" onStatusChange={vi.fn()} onReset={vi.fn()} />
    );

    expect(screen.getByRole("tablist", { name: "Booking status" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Booking type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All types" })).not.toBeInTheDocument();
  });

  it("marks the active status and reports a change", () => {
    const { onStatusChange } = renderFilters({ status: "pending" });

    expect(screen.getByRole("tab", { name: "Pending" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "false");
    fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
    expect(onStatusChange).toHaveBeenCalledWith("completed");
  });

  it("marks the active type and reports a change", () => {
    const { onKindChange } = renderFilters({ kind: "video" });

    expect(screen.getByRole("button", { name: "Telemedicine" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All types" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Home based" }));
    expect(onKindChange).toHaveBeenCalledWith("home");
  });

  it("offers Clear filters only while something is filtered", () => {
    const { unmount } = render(
      <BookingListFilters statusTabs={TABS} status="all" kind="all" defaultStatus="all" onStatusChange={vi.fn()} onKindChange={vi.fn()} onReset={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    unmount();

    const { onReset } = renderFilters({ kind: "home" });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("maps the type to the server filter", () => {
    expect(kindToIsTelemedicine("all")).toBeUndefined();
    expect(kindToIsTelemedicine("video")).toBe(true);
    expect(kindToIsTelemedicine("home")).toBe(false);
  });
});

describe("BookingKindBadge", () => {
  it("says Telemedicine for a remote consultation and Home based for a home visit, in words", () => {
    const { unmount } = render(<BookingKindBadge isTelemedicine />);
    expect(screen.getByText("Telemedicine")).toBeInTheDocument();
    expect(screen.queryByText(/video/i)).not.toBeInTheDocument();
    unmount();

    render(<BookingKindBadge isTelemedicine={false} />);
    expect(screen.getByText("Home based")).toBeInTheDocument();
  });
});
