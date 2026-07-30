import { describe, expect, it } from "vitest";

import { canUseGlobalPaymentLedger } from "../PaymentsPage";

describe("PaymentsPage access helpers", () => {
  it("keeps the global payment ledger limited to platform admins", () => {
    expect(canUseGlobalPaymentLedger(["admin.super"])).toBe(true);
    expect(canUseGlobalPaymentLedger(["admin"])).toBe(true);
    expect(canUseGlobalPaymentLedger(["admin.ops"])).toBe(false);
    expect(canUseGlobalPaymentLedger(["provider"])).toBe(false);
  });
});
