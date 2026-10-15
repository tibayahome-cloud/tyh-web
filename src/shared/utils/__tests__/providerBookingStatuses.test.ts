import { describe, expect, it } from "vitest";

import { PROVIDER_CANCELLED_STATUSES, PROVIDER_UPCOMING_STATUSES } from "../providerBookingStatuses";

describe("provider booking status lists", () => {
  it("count a booked video consultation as upcoming", () => {
    expect(PROVIDER_UPCOMING_STATUSES).toContain("scheduled");
  });

  it("count a consultation cancelled after payment as cancelled", () => {
    expect(PROVIDER_CANCELLED_STATUSES).toContain("telemedicine_cancelled_payment_review");
  });
});
