import { describe, expect, it } from "vitest";

import { formatFacilityResponseWindow } from "../QueuePage";

describe("facility response queue state", () => {
  it("formats a live response countdown", () => {
    expect(formatFacilityResponseWindow("2026-08-04T10:03:00.000Z", new Date("2026-08-04T10:00:00.000Z").getTime())).toBe("3m 00s");
  });

  it("shows expiry and handles missing or invalid deadlines", () => {
    const now = new Date("2026-08-04T10:00:00.000Z").getTime();
    expect(formatFacilityResponseWindow("2026-08-04T09:59:00.000Z", now)).toBe("Expired");
    expect(formatFacilityResponseWindow(null, now)).toBe("-");
    expect(formatFacilityResponseWindow("invalid", now)).toBe("-");
  });
});
