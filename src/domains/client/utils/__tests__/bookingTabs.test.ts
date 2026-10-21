import { describe, expect, it } from "vitest";

import { KNOWN_BOOKING_STATUSES } from "../../../../shared/utils/bookingStatus";
import { CLIENT_BOOKING_TABS, tabForStatus } from "../bookingTabs";

describe("client booking tabs", () => {
  it("places every known booking status in exactly one tab", () => {
    for (const status of KNOWN_BOOKING_STATUSES) {
      const holders = CLIENT_BOOKING_TABS.filter((tab) => tab.statuses.includes(status));
      expect(holders.map((tab) => tab.key), `status ${status}`).toHaveLength(1);
    }
  });

  it("does not list a status the app does not know", () => {
    const known = new Set(KNOWN_BOOKING_STATUSES);
    for (const tab of CLIENT_BOOKING_TABS) {
      for (const status of tab.statuses) expect(known.has(status), `${tab.key}: ${status}`).toBe(true);
    }
  });

  it("puts the video-consultation states where a person would look for them", () => {
    expect(tabForStatus("telemedicine_payment_pending")).toBe("pending");
    expect(tabForStatus("telemedicine_paid_pending_assignment")).toBe("pending");
    expect(tabForStatus("telemedicine_unattended")).toBe("pending");
    expect(tabForStatus("telemedicine_cancelled_payment_review")).toBe("cancelled");
    expect(tabForStatus("scheduled")).toBe("upcoming");
  });

  it("has an All tab that asks for no status filter", () => {
    expect(CLIENT_BOOKING_TABS[0]).toMatchObject({ key: "all", statuses: [] });
  });
});
