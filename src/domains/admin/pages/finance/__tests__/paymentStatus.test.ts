import { describe, expect, it } from "vitest";

import {
  NEXT_ACTION,
  REVIEW_BADGE,
  STATUS_LABEL,
  STATUS_TONE,
  describeRefund,
  describeSettlement,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getWithdrawalStatusLabel,
  getWithdrawalStatusTone
} from "../paymentStatus";

describe("payment status labels", () => {
  it("distinguishes a payment never sent from one awaiting a callback", () => {
    // They were the same value in the backend until recently, and they need different handling:
    // one can simply be retried, the other has a prompt outstanding that may still succeed.
    expect(STATUS_LABEL.pending).not.toEqual(STATUS_LABEL.awaiting_callback);
    expect(STATUS_LABEL.awaiting_callback).toMatch(/awaiting/i);
  });

  it("never describes a state as more final than it is", () => {
    expect(STATUS_LABEL.pending).not.toMatch(/paid|complete/i);
    expect(STATUS_LABEL.awaiting_callback).not.toMatch(/paid|complete/i);
  });
});

describe("settlement", () => {
  it("reports an unsettled payment as unsettled", () => {
    // Showing a provider as paid when nothing was disbursed is the most damaging thing this
    // table could get wrong.
    expect(describeSettlement(false, null).label).toBe("Not settled");
  });

  it("does not imply a payout when settlement recorded none", () => {
    expect(describeSettlement(true, 0).label).toMatch(/no payout/i);
    expect(describeSettlement(true, 0).label).not.toBe("Settled");
  });

  it("reports a real payout plainly", () => {
    expect(describeSettlement(true, 120000).label).toBe("Settled");
  });
});

describe("refunds", () => {
  it("says nothing when no refund exists", () => {
    expect(describeRefund(null)).toBeNull();
  });

  it("separates a refund in flight from one that landed", () => {
    // An operator approving a refund does not move money; the gateway does.
    expect(describeRefund("pending")?.label).toBe("Refund pending");
    expect(describeRefund("succeeded")?.label).toBe("Refunded");
    expect(describeRefund("pending")?.label).not.toBe(describeRefund("succeeded")?.label);
  });

  it("surfaces a failed refund rather than hiding it", () => {
    expect(describeRefund("failed")?.label).toMatch(/failed/i);
  });
});

describe("review", () => {
  it("is shown alongside status rather than replacing it", () => {
    // The payment succeeded -- money arrived. Folding review into the status column would
    // erase the fact that the client paid.
    expect(REVIEW_BADGE.label).toBe("Needs review");
    expect(Object.values(STATUS_LABEL)).not.toContain(REVIEW_BADGE.label);
  });
});

describe("next actions", () => {
  it("only suggests one where there is something to do", () => {
    expect(NEXT_ACTION.succeeded).toBeUndefined();
    expect(NEXT_ACTION.failed).toBeTruthy();
  });
});

describe("getPaymentStatusLabel / getPaymentStatusTone", () => {
  it("resolves the human label and tone for a known payment status", () => {
    expect(getPaymentStatusLabel("awaiting_callback")).toBe(STATUS_LABEL.awaiting_callback);
    expect(getPaymentStatusTone("succeeded")).toBe(STATUS_TONE.succeeded);
  });

  it("falls back to a humanized string instead of throwing on an unknown status", () => {
    expect(getPaymentStatusLabel("some_future_status")).toBe("some future status");
    expect(getPaymentStatusTone("some_future_status")).toBe("bg-slate-200 text-slate-600");
  });
});

describe("getWithdrawalStatusLabel / getWithdrawalStatusTone", () => {
  it("describes the withdrawal lifecycle distinctly from payment status", () => {
    expect(getWithdrawalStatusLabel("disbursing")).toBe("Disbursing");
    expect(getWithdrawalStatusLabel("rejected")).toBe("Rejected");
    expect(getWithdrawalStatusTone("disbursed")).toMatch(/emerald/);
    expect(getWithdrawalStatusTone("rejected")).toMatch(/rose/);
  });

  it("is case-insensitive since backends don't always agree on casing", () => {
    expect(getWithdrawalStatusLabel("DISBURSED")).toBe("Disbursed");
  });

  it("falls back to a humanized string instead of throwing on an unknown status", () => {
    expect(getWithdrawalStatusLabel("some_future_status")).toBe("some future status");
    expect(getWithdrawalStatusTone("some_future_status")).toBe("bg-slate-200 text-slate-600");
  });
});
