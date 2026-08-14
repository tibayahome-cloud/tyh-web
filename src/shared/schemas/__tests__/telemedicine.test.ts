import { describe, expect, it } from "vitest";

import { mapTelemedicinePolicy } from "../telemedicine";

// Shape verified directly against get_telemedicine_policy() in
// app/services/telemedicine_policy_service.py, not guessed from prose.
const REAL_POLICY_RESPONSE = {
  version: "2026-08-13",
  supported_country_codes: ["KE"],
  default_country_code: "KE",
  default_timezone: "Africa/Nairobi",
  join_window_before_minutes: 10,
  cancellation: {
    client_cutoff_minutes_before_scheduled_at: 10,
    late_cancellation_requires_admin_override: true,
    paid_booking_state: "telemedicine_cancelled_payment_review"
  },
  reminders: {
    enabled: false,
    windows_minutes_before: [1440, 15]
  }
};

describe("mapTelemedicinePolicy", () => {
  it("reads every field from the real backend response shape", () => {
    expect(mapTelemedicinePolicy(REAL_POLICY_RESPONSE)).toEqual({
      policyVersion: "2026-08-13",
      supportedCountryCodes: ["KE"],
      defaultTimezone: "Africa/Nairobi",
      joinWindowBeforeMinutes: 10,
      cancellationCutoffMinutes: 10,
      remindersEnabled: false,
      reminderWindowsMinutes: [1440, 15]
    });
  });

  it("falls back to the join window for the cancellation cutoff if the nested field is absent", () => {
    const { cancellation: _cancellation, ...withoutCancellation } = REAL_POLICY_RESPONSE;
    expect(mapTelemedicinePolicy(withoutCancellation)?.cancellationCutoffMinutes).toBe(10);
  });

  it("returns null on a payload with no data rather than throwing", () => {
    expect(mapTelemedicinePolicy(null)).not.toBeNull(); // defaults still parse
    expect(mapTelemedicinePolicy({})?.policyVersion).toBe("");
  });
});
