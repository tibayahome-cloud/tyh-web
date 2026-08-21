import { describe, expect, it } from "vitest";

import { findBookingUnderPaymentReview } from "../../utils/paymentReview";

const booking = (overrides: Record<string, unknown> = {}) =>
  ({ id: "b1", paymentReviewPending: false, ...overrides }) as never;

describe("finding a booking whose payment is under review", () => {
  it("returns nothing when no payment is held", () => {
    expect(findBookingUnderPaymentReview([booking(), booking({ id: "b2" })])).toBeUndefined();
  });

  it("finds one regardless of which list it came from", () => {
    // The home page searches the active, matching and upcoming lists together, because the
    // booking can be in any of them and the client needs telling either way.
    const held = booking({ id: "b3", paymentReviewPending: true });

    expect(findBookingUnderPaymentReview([booking(), undefined, held])?.id).toBe("b3");
  });

  it("tolerates the gaps a not-yet-loaded list leaves", () => {
    // These lists are separate queries, so nulls and undefined are the normal in-between state
    // rather than an error worth crashing the page over.
    expect(findBookingUnderPaymentReview([null, undefined])).toBeUndefined();
  });

  it("never treats an ordinary booking as under review", () => {
    // The field defaults false when absent, so an older API response cannot make a healthy
    // booking display a payment warning.
    expect(findBookingUnderPaymentReview([booking({ paymentReviewPending: undefined })])).toBeUndefined();
  });
});
