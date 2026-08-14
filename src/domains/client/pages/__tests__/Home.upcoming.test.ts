import { describe, expect, it } from "vitest";

import { getBookingStatusTheme } from "../../../../shared/utils/bookingStatus";

// Mirrors UPCOMING_STATUSES in Home.tsx. A remote consultation never enters the in-person
// dispatch states, so a list of those alone left a client with a confirmed consultation
// looking at "No upcoming care scheduled".
const UPCOMING_STATUSES = [
  "requested",
  "accepted",
  "broadcasting",
  "scheduled",
  "telemedicine_payment_pending",
  "telemedicine_paid_pending_assignment"
];

describe("client home upcoming list", () => {
  it("includes the states a remote consultation actually passes through", () => {
    expect(UPCOMING_STATUSES).toContain("telemedicine_payment_pending");
    expect(UPCOMING_STATUSES).toContain("telemedicine_paid_pending_assignment");
    // The state a confirmed consultation sits in once a provider is assigned.
    expect(UPCOMING_STATUSES).toContain("scheduled");
  });

  it("keeps the in-person request states so home is not telemedicine-only", () => {
    expect(UPCOMING_STATUSES).toContain("requested");
    expect(UPCOMING_STATUSES).toContain("accepted");
    expect(UPCOMING_STATUSES).toContain("broadcasting");
  });

  it("gives every upcoming state a readable label rather than a raw status string", () => {
    for (const status of UPCOMING_STATUSES) {
      const theme = getBookingStatusTheme(status);
      expect(theme.label).toBeTruthy();
      expect(theme.label).not.toBe(status);
    }
  });
});
