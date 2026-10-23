import { describe, expect, it } from "vitest";

import { mapLiveStatus } from "../liveStatus";

describe("mapLiveStatus", () => {
  it("reads a live facility with its next free time", () => {
    const status = mapLiveStatus({
      data: { live: true, blockers: [], first_blocker: null, next_open_at: "2026-10-21T07:40:00+00:00", lookahead_days: 7 }
    });

    expect(status).toEqual({ live: true, firstBlocker: null, blockers: [], nextOpenAt: "2026-10-21T07:40:00+00:00", lookaheadDays: 7 });
  });

  it("keeps every blocker and the one to show first", () => {
    const blockers = [
      { code: "not_verified", message: "The provider is not verified yet.", fix: "provider_verification" },
      { code: "no_remote_availability", message: "No weekly hours are set.", fix: "provider_availability" }
    ];
    const status = mapLiveStatus({ data: { live: false, blockers, first_blocker: blockers[0] } });

    expect(status.live).toBe(false);
    expect(status.blockers.map((b) => b.code)).toEqual(["not_verified", "no_remote_availability"]);
    expect(status.firstBlocker?.fix).toBe("provider_verification");
  });

  it("falls back to the first blocker when the server does not name one", () => {
    const status = mapLiveStatus({ data: { live: false, blockers: [{ code: "no_country", message: "No country.", fix: "facility_location" }] } });

    expect(status.firstBlocker?.code).toBe("no_country");
  });

  it("never reads a malformed answer as live", () => {
    expect(mapLiveStatus(null).live).toBe(false);
    expect(mapLiveStatus({ data: { live: "yes", blockers: [{ nope: 1 }] } })).toMatchObject({ live: false, blockers: [] });
  });
});
