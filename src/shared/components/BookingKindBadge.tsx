import { House, MonitorSmartphone } from "lucide-react";

// Says which kind of booking this is, so a list does not need a line like "Location not specified" to hint at it.
// "Telemedicine" rather than "Video": the call can be joined with the camera off, so it is not always a video
// call. An icon and a word, never colour alone.
export const BookingKindBadge = ({ isTelemedicine, className = "" }: { isTelemedicine: boolean; className?: string }) =>
  isTelemedicine ? (
    <span className={`inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 ${className}`}>
      <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" />
      Telemedicine
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ${className}`}>
      <House className="h-3.5 w-3.5" aria-hidden="true" />
      Home based
    </span>
  );

export default BookingKindBadge;
