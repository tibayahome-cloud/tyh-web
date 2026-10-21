import { CareTypeBadge, toCareType, type CareType } from "./CareTypeBadge";

// Says which kind of booking this is, so a list does not need a line like "Location not specified" to hint at it.
// "Telemedicine" rather than "Video": the call can be joined with the camera off, so it is not always a video call.
// A booking for an ambulance service says Ambulance. Same words and colours as the services themselves.
export const BookingKindBadge = ({
  isTelemedicine,
  careType,
  className = ""
}: {
  isTelemedicine: boolean;
  careType?: CareType | string | null;
  className?: string;
}) => <CareTypeBadge careType={isTelemedicine ? "telemedicine" : toCareType(careType)} className={className} />;

export default BookingKindBadge;
