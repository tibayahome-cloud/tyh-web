import { describe, expect, it } from "vitest";

import { mapProviderDetail } from "../ProviderDetailPage";

describe("mapProviderDetail", () => {
  const payload = {
    id: "p1", user_id: "u1", verified: true, telemedicine_enabled: true, timezone: "Africa/Nairobi",
    facility: { id: "f1", name: "Care Point" },
    user: { id: "u1", full_name: "Dr Gitobu", email: "g@care.test", status: "active" },
    availability: [{ id: "w1", weekday: "mon", start_time: "05:00:00+00", end_time: "14:00:00+00", start_time_local: "08:00:00", end_time_local: "17:00:00", delivery_mode: "remote" }],
    telemedicine_subcategory_assignments: [
      { id: "a1", subcategory_id: "s1", status: "active", subcategory: { id: "s1", name: "Cardiology", status: "active", category: { id: "c1", name: "Specialist care", status: "active" } } },
      { id: "a2", subcategory_id: "s2", status: "removed", subcategory: { id: "s2", name: "Urology", status: "archived", category: { id: "c1", name: "Specialist care", status: "active" } } }
    ]
  };

  it("keeps the local times and delivery mode of each availability window", () => {
    const provider = mapProviderDetail(payload);
    expect(provider.availability[0]).toMatchObject({ weekday: "mon", startTimeLocal: "08:00:00", endTimeLocal: "17:00:00", deliveryMode: "remote" });
  });

  it("maps specialties with their category, and keeps removed ones with their status", () => {
    const { specialties } = mapProviderDetail(payload);
    expect(specialties).toHaveLength(2);
    expect(specialties[0]).toMatchObject({ name: "Cardiology", status: "active", categoryName: "Specialist care", subcategoryStatus: "active" });
    expect(specialties[1]).toMatchObject({ name: "Urology", status: "removed", subcategoryStatus: "archived" });
  });

  it("maps the facility, telemedicine flag and timezone", () => {
    expect(mapProviderDetail(payload)).toMatchObject({ facility: { id: "f1", name: "Care Point" }, telemedicineEnabled: true, timezone: "Africa/Nairobi" });
  });

  it("copes with a response that has none of the new fields", () => {
    const provider = mapProviderDetail({ id: "p2", user_id: "u2", availability: [{ id: "w", weekday: "tue", start_time: "09:00", end_time: "10:00" }] });
    expect(provider).toMatchObject({ facility: null, telemedicineEnabled: false, specialties: [] });
    expect(provider.availability[0]).toMatchObject({ startTimeLocal: null, deliveryMode: null });
  });
});
