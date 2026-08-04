import type { Booking } from "../../../shared/schemas/booking";

type FacilityRerouteState = Pick<Booking, "requestMode" | "facilityStatus" | "provider">;

export const canConfirmFacilityReroute = (booking: FacilityRerouteState): boolean =>
  booking.requestMode === "selected_facility" &&
  booking.facilityStatus === "expired" &&
  !booking.provider;
