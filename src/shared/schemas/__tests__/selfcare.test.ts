import { describe, expect, it } from "vitest";

import { mapSelfCareAlert, mapSelfCareCheckin, mapSelfCareProfile } from "../selfcare";

describe("self-care mappers", () => {
  it("keeps the symptoms a check-in was logged with", () => {
    const checkin = mapSelfCareCheckin({
      id: "c1",
      symptoms: [{ label: "Cough" }, { name: "Fever" }, "Headache", { other: 1 }]
    });

    expect(checkin?.symptoms).toEqual([{ label: "Cough" }, { label: "Fever" }, { label: "Headache" }]);
  });

  it("returns an empty list when there are no symptoms", () => {
    expect(mapSelfCareCheckin({ id: "c1" })?.symptoms).toEqual([]);
  });

  it("keeps the profile status and last check-in", () => {
    const profile = mapSelfCareProfile({ id: "p1", status: "paused", last_checkin_at: "2026-10-01T08:00:00Z" });

    expect(profile?.status).toBe("paused");
    expect(profile?.lastCheckinAt).toContain("2026-10-01");
  });

  it("keeps the alert channel and the provider it was sent to", () => {
    const alert = mapSelfCareAlert({
      id: "a1",
      channel: "push",
      provider_user_id: "u2",
      provider: { id: "u2", full_name: "Dr Example" }
    });

    expect(alert?.channel).toBe("push");
    expect(alert?.providerUserId).toBe("u2");
    expect(alert?.provider?.fullName).toBe("Dr Example");
  });
});
