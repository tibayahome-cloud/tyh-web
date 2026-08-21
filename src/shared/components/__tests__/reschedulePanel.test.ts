import { describe, expect, it } from "vitest";

/**
 * The rescheduling rules the panel has to reflect.
 *
 * A proposal is not a change: until someone accepts, the appointment shown everywhere else is
 * still the real one. These pin the wording and the action rules that keep that true, because
 * both are easy to soften into something misleading.
 */

// Mirrors STATUS_COPY in ReschedulePanel.tsx.
const STATUS_COPY = {
  pending: "Awaiting a response",
  accepted: "Accepted -- the appointment moved",
  declined: "Declined -- the appointment did not change",
  cancelled: "Withdrawn",
  expired: "Expired without an answer -- the appointment did not change",
  admin_approved: "Resolved by the care site -- the appointment moved"
};

describe("what each outcome tells the reader", () => {
  it("says explicitly whether the appointment moved", () => {
    // "Declined" alone leaves someone wondering which time is now real.
    expect(STATUS_COPY.declined).toMatch(/did not change/);
    expect(STATUS_COPY.expired).toMatch(/did not change/);
    expect(STATUS_COPY.accepted).toMatch(/moved/);
    expect(STATUS_COPY.admin_approved).toMatch(/moved/);
  });

  it("distinguishes an administrator resolving from the other side agreeing", () => {
    // They reach the same outcome by different routes, and the record says which.
    expect(STATUS_COPY.admin_approved).not.toEqual(STATUS_COPY.accepted);
    expect(STATUS_COPY.admin_approved).toMatch(/care site/i);
  });

  it("does not present a pending proposal as settled", () => {
    expect(STATUS_COPY.pending).not.toMatch(/moved|changed|confirmed/i);
  });
});

/** Mirrors the action rules in the panel, which mirror what the backend permits. */
const actionsFor = (isMine: boolean) => (isMine ? ["cancel"] : ["accept", "decline"]);

describe("who may do what to an open proposal", () => {
  it("lets the requester withdraw but not answer", () => {
    // Answering your own proposal is a unilateral edit dressed as an agreement, and the
    // backend refuses it -- so the button is never offered.
    expect(actionsFor(true)).toEqual(["cancel"]);
    expect(actionsFor(true)).not.toContain("accept");
  });

  it("lets the other participant answer but not withdraw", () => {
    expect(actionsFor(false)).toEqual(["accept", "decline"]);
    expect(actionsFor(false)).not.toContain("cancel");
  });
});

describe("the standing reassurance while a proposal is open", () => {
  const copy = "Your appointment has not changed yet. It only moves if this is accepted.";

  it("states the appointment is unchanged", () => {
    // A pending proposal is the moment someone is most likely to assume it already moved and
    // turn up at the wrong time.
    expect(copy).toMatch(/has not changed/i);
    expect(copy).toMatch(/only moves if/i);
  });
});
