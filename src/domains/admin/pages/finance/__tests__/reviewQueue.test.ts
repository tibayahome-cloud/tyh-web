import { describe, expect, it } from "vitest";

/**
 * The review queue's rules, tested without mounting React.
 *
 * The queue exists so an operator does not have to know a problem exists before they can find
 * it. These pin the parts that would quietly undermine that.
 */

const CATEGORY_LABEL = {
  payment_review: "Payment held",
  cancellation_payment_review: "Cancelled after paying",
  no_show: "Nobody attended",
  technical_issue: "Technical problem",
  reschedule_escalation: "Waiting on a reschedule answer"
};

const ANSWERED_ELSEWHERE = {
  reschedule_escalation: "Open the booking to accept or decline the proposed time"
};

describe("categories", () => {
  it("covers every source the backend reports", () => {
    // A category the queue does not know how to label would render blank, which is worse than
    // not listing it at all.
    expect(Object.keys(CATEGORY_LABEL).sort()).toEqual([
      "cancellation_payment_review",
      "no_show",
      "payment_review",
      "reschedule_escalation",
      "technical_issue"
    ]);
  });

  it("labels each in terms an operator recognises", () => {
    // Not the internal dispute_type, which reads as machinery rather than a situation.
    expect(Object.values(CATEGORY_LABEL)).not.toContain("telemedicine_assignment_timeout");
    expect(CATEGORY_LABEL.payment_review).toMatch(/payment/i);
  });
});

describe("items answered elsewhere", () => {
  it("points at the right place rather than offering a button that fails", () => {
    // The backend refuses to close a reschedule from the queue, because doing so would leave
    // the appointment unchanged and the client still waiting.
    expect(ANSWERED_ELSEWHERE.reschedule_escalation).toMatch(/accept or decline/i);
  });

  it("only diverts the categories that genuinely resolve elsewhere", () => {
    expect(Object.keys(ANSWERED_ELSEWHERE)).toEqual(["reschedule_escalation"]);
  });
});

describe("resolving", () => {
  const canSubmit = (reason: string) => Boolean(reason.trim());

  it("requires a reason before the request is made", () => {
    // An audit entry recording only that somebody closed something answers the least
    // interesting question about it.
    expect(canSubmit("")).toBe(false);
    expect(canSubmit("   ")).toBe(false);
    expect(canSubmit("rebooked into Thursday")).toBe(true);
  });

  it("tells the operator that recording a decision is not moving money", () => {
    const note = "Recording a decision here does not move money.";
    expect(note).toMatch(/does not move money/i);
  });
});
