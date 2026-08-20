import type { Booking } from "../../../shared/schemas/booking";

/**
 * The booking, if any, whose payment is held pending an operator decision.
 *
 * Searched across every list the home page already loads rather than fetched separately: a
 * client who has paid and has no confirmed appointment needs to see it wherever that booking
 * happens to appear, and one more request for a state that is usually absent is not worth it.
 *
 * Returns the first match. More than one payment under review for the same client at once is
 * possible but vanishingly rare, and showing the oldest is not obviously better than showing
 * whichever list found it first -- what matters is that they are told at all.
 */
export const findBookingUnderPaymentReview = (
  candidates: Array<Booking | null | undefined>
): Booking | undefined => candidates.find((booking) => booking?.paymentReviewPending) ?? undefined;
