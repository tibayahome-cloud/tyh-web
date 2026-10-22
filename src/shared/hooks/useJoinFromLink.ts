import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { isWithinJoinWindow } from "../utils/telemedicine";

type JoinableBooking = {
  id: string;
  isTelemedicine: boolean;
  scheduledAt: string | null;
  estimateDurationMinutes: number | null;
  /** Null while no doctor is assigned: there is nothing to join then. */
  provider?: unknown | null;
};

// Arriving at a booking with ?join=1 (the Join button on Home) opens the call once the booking has loaded and its
// call window is open. The parameter is removed straight away, so a refresh or the back button does not open it
// again. If the window is not open, nothing opens and the page shows its own "the call opens at..." message.
export const useJoinFromLink = (
  booking: JoinableBooking | null | undefined,
  joinWindowBeforeMinutes: number | undefined,
  onJoin: () => void
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("join") === "1";

  useEffect(() => {
    if (!requested || !booking) return;
    if (
      booking.isTelemedicine &&
      booking.provider !== null &&
      isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes, Date.now(), joinWindowBeforeMinutes)
    ) {
      onJoin();
    }
    setSearchParams({}, { replace: true });
    // Once per arrival: the booking id is what identifies the arrival, not the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, booking?.id]);
};
