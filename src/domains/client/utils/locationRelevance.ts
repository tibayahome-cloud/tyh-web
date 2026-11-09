import type { Booking } from "../../../shared/schemas/booking";

/**
 * Whether Home should ask for the phone's location.
 *
 * Location matters to home care, where a provider travels to the client. A client who only books video consultations has
 * no use for it, and a permission banner on their first screen is a question they cannot see the reason for. It shows
 * only while an in-person booking is active or being matched. Booking home care asks for a place inside that flow.
 */
export const shouldAskForLocation = (bookings: Array<Pick<Booking, "isTelemedicine"> | null | undefined>): boolean =>
  bookings.some((booking) => Boolean(booking) && !booking?.isTelemedicine);
