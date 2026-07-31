import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FacilityBookingRow } from "../FacilityWorkspacePage";
import type { Booking } from "../../../../../shared/schemas/booking";

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
    facilityResponseDueAt: "2026-07-30T08:03:00Z",
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
    client: {
      id: "client-1",
      fullName: "Client One",
      avatarUrl: null,
      email: "client@example.test",
      phone: null
    },
    provider: null,
    service: {
      id: "service-1",
      name: "Dressing",
      key: "dressing",
      basePriceCents: 120000,
      defaultEstimateMinutes: 45
    },
    locations: [],
    events: [],
    feedback: [],
    ...overrides
  }) as Booking;

describe("FacilityBookingRow", () => {
  it("shows assign-and-claim for unassigned facility bookings", async () => {
    const booking = bookingFactory();
    const onAssign = vi.fn();
    const user = userEvent.setup();

    render(
      <FacilityBookingRow
        booking={booking}
        canAssign
        nowMs={new Date("2026-07-30T08:00:00Z").getTime()}
        onAssign={onAssign}
      />
    );

    expect(screen.getByText("Dressing")).toBeInTheDocument();
    expect(screen.getByText(/Client One.*Kilimani/)).toBeInTheDocument();
    expect(screen.getByText("3m 00s")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /assign & claim/i }));

    expect(onAssign).toHaveBeenCalledWith(booking);
  });

  it("shows reassignment copy when a provider is already assigned", () => {
    render(
      <FacilityBookingRow
        booking={bookingFactory({
          provider: {
            id: "provider-user-1",
            fullName: "Provider One",
            avatarUrl: null,
            email: "provider@example.test",
            phone: null
          },
          facilityStatus: "claimed"
        })}
        canAssign
        nowMs={new Date("2026-07-30T08:00:00Z").getTime()}
        onAssign={vi.fn()}
      />
    );

    expect(screen.getByText("Provider One")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reassign/i })).toBeInTheDocument();
  });

  it("hides assignment actions when the actor cannot manage bookings", () => {
    render(
      <FacilityBookingRow
        booking={bookingFactory()}
        canAssign={false}
        nowMs={new Date("2026-07-30T08:00:00Z").getTime()}
        onAssign={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /assign/i })).not.toBeInTheDocument();
  });
});
