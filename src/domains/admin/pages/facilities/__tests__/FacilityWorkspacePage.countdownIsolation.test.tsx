/**
 * The facility-response countdown lived as `nowMs` state on the whole workspace page, ticking
 * every second and re-rendering every booking row (and everything else on the page) for a
 * value only one small block of each row actually used. FacilityBookingRow is now memoized and
 * the countdown owns its own timer, so a tick for one booking must not re-render a sibling row
 * that has nothing left to count down (no facilityResponseDueAt).
 */

import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { FacilityBookingRow } from "../FacilityWorkspacePage";
import type { Booking } from "../../../../../shared/schemas/booking";

let siblingRenderCount = 0;

const bookingFactory = (overrides: Partial<Booking> = {}): Booking =>
  ({
    id: "booking-1",
    status: "pending",
    scheduledAt: null,
    bookingType: "immediate",
    parentBookingId: null,
    preferredProviderId: null,
    facilityId: "facility-1",
    requestMode: "selected_facility",
    facilityStatus: "pending",
    facilityClaimedAt: null,
    facilityResponseDueAt: null,
    clientConfirmedRerouteAt: null,
    addressText: "Kilimani",
    lat: -1.2921,
    lng: 36.8219,
    priceCents: 120000,
    currency: "KES",
    estimateDurationMinutes: 45,
    acceptedAt: null,
    arrivedAt: null,
    serviceStartedAt: null,
    serviceCompletedAt: null,
    clientConfirmedAt: null,
    paidAt: null,
    cancelledAt: null,
    cancelReason: null,
    escalationAt: null,
    escalatedAt: null,
    createdAt: null,
    updatedAt: null,
    meta: {},
    client: { id: "client-1", fullName: "Client One", avatarUrl: null, email: "client@example.test", phone: null },
    provider: null,
    service: { id: "service-1", name: "Dressing", key: "dressing", basePriceCents: 120000, defaultEstimateMinutes: 45 },
    locations: [],
    events: [],
    feedback: [],
    ...overrides
  }) as Booking;

// A sibling row with no due date -- it renders "-" and never needs to update again, so a
// working fix should never re-render it just because a *different* row's timer ticked.
const SiblingRow = (props: { booking: Booking; canAssign: boolean; onAssign: () => void }) => {
  siblingRenderCount += 1;
  return <FacilityBookingRow {...props} />;
};

describe("FacilityBookingRow countdown isolation", () => {
  beforeEach(() => {
    siblingRenderCount = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not rerender a sibling row without a due date when another row's countdown ticks", () => {
    render(
      <div>
        <FacilityBookingRow
          booking={bookingFactory({ id: "ticking", facilityResponseDueAt: "2026-07-30T08:05:00Z" })}
          canAssign
          onAssign={vi.fn()}
        />
        <SiblingRow booking={bookingFactory({ id: "static", facilityResponseDueAt: null })} canAssign onAssign={vi.fn()} />
      </div>
    );

    const baseline = siblingRenderCount;
    expect(baseline).toBeGreaterThan(0);

    const countdownBefore = screen.getByText(/^\d+m \d{2}s$/).textContent;

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(siblingRenderCount).toBe(baseline);

    const countdownAfter = screen.getByText(/^\d+m \d{2}s$/).textContent;
    expect(countdownAfter).not.toBe(countdownBefore);
  });
});
