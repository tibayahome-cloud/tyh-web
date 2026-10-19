import { describe, expect, it } from "vitest";

import { mapStrandedWallet, parseTypedShillings } from "../strandedWallets";

describe("parseTypedShillings", () => {
  it.each([
    ["1000", 100000],
    ["1,000", 100000],
    ["1000.00", 100000],
    ["KES 1,000.50", 100050],
    ["  40 ", 4000]
  ])("reads %s as %i cents", (typed, cents) => expect(parseTypedShillings(typed)).toBe(cents));

  it.each(["", "abc", "10.555", "-5", "1 000 and more", "10,00,0x"])("refuses %j", (typed) =>
    expect(parseTypedShillings(typed)).toBeNull()
  );
});

describe("mapStrandedWallet", () => {
  it("reads the API fields", () => {
    expect(
      mapStrandedWallet({
        user_id: "u1",
        full_name: "Sample Person",
        deleted_at: "2026-10-15T08:00:00Z",
        currency: "KES",
        balance_cents: 100000,
        reserved_cents: 6000,
        available_cents: 94000,
        withdrawals_in_progress: 1,
        can_settle: false,
        blocker: "A withdrawal for this wallet is still in progress."
      })
    ).toEqual({
      userId: "u1",
      fullName: "Sample Person",
      deletedAt: "2026-10-15T08:00:00Z",
      currency: "KES",
      balanceCents: 100000,
      reservedCents: 6000,
      availableCents: 94000,
      withdrawalsInProgress: 1,
      canSettle: false,
      blocker: "A withdrawal for this wallet is still in progress."
    });
  });

  it("drops a row with no account id, and never invents permission to settle", () => {
    expect(mapStrandedWallet({ balance_cents: 5 })).toBeNull();
    expect(mapStrandedWallet({ user_id: "u2" })?.canSettle).toBe(false);
  });
});
