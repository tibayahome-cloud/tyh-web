import { describe, expect, it } from "vitest";

import { isBookingPastSetup, KNOWN_BOOKING_STATUSES } from "../bookingStatus";

describe("isBookingPastSetup", () => {
  it("is false while a provider is being found or payment has not arrived", () => {
    for (const status of ["requested", "broadcasting", "telemedicine_payment_pending"]) {
      expect(isBookingPastSetup(status)).toBe(false);
    }
  });

  it("is true once a booking is confirmed, paid for, under way, finished or cancelled", () => {
    for (const status of [
      "scheduled",
      "accepted",
      "in_service",
      "fully_completed",
      "paid",
      "cancelled_by_client",
      "expired_no_accept",
      "telemedicine_paid_pending_assignment",
      "telemedicine_cancelled_payment_review"
    ]) {
      expect(isBookingPastSetup(status)).toBe(true);
    }
  });

  it("ignores case, and treats a status the app has never heard of as past setup", () => {
    expect(isBookingPastSetup("Requested")).toBe(false);
    expect(isBookingPastSetup("some_new_status")).toBe(true);
  });

  it("leaves exactly the three setup states out of every known status", () => {
    const notPast = KNOWN_BOOKING_STATUSES.filter((status) => !isBookingPastSetup(status));
    expect(notPast.sort()).toEqual(["broadcasting", "requested", "telemedicine_payment_pending"]);
  });
});
