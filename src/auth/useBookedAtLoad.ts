import { useEffect, useRef, useState } from "react";

import { useAuth } from "../shared/hooks/useAuth";
import { useBookingList } from "../shared/hooks/useBookings";
import { isBookingPastSetup } from "../shared/utils/bookingStatus";

/**
 * Whether this client had already booked when the app loaded.
 *
 * It is decided once, from the first answer, and not updated afterwards. A client who books and pays during this visit
 * must not be interrupted by a question about their phone number while the M-Pesa request is still waiting for them;
 * they are asked the next time they open the app. A booking that is still being set up (a provider is being found, or
 * payment has not arrived) does not count as having booked.
 */
export const useBookedAtLoad = (): boolean => {
  const { user } = useAuth();
  // Nothing to ask about for someone who has no number or has already confirmed it, so do not look their bookings up.
  const needed = Boolean(user?.id) && Boolean(user?.phone) && !user?.phoneVerifiedAt;
  const bookings = useBookingList({ clientId: user?.id ?? undefined, pageSize: 5, preset: "card" }, { enabled: needed });

  const decided = useRef(false);
  const [bookedAtLoad, setBookedAtLoad] = useState(false);

  useEffect(() => {
    if (decided.current || !bookings.isSuccess) {
      return;
    }
    decided.current = true;
    setBookedAtLoad((bookings.data?.bookings ?? []).some((booking) => isBookingPastSetup(booking.status)));
  }, [bookings.isSuccess, bookings.data]);

  return bookedAtLoad;
};
