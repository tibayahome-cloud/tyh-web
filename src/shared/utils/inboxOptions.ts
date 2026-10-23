export type ConversationOption = {
  bookingId: string;
  /** The other person, by name. */
  name: string;
  /** What the visit or consultation was, e.g. "Wound dressing". */
  service: string;
  /** When it was, e.g. "21 Oct". */
  when: string;
};

type BookingLike = {
  id?: string | null;
  scheduledAt?: string | null;
  createdAt?: string | null;
  service?: { name?: string | null } | null;
  client?: { id?: string | null; fullName?: string | null; email?: string | null } | null;
  provider?: { id?: string | null; fullName?: string | null; email?: string | null } | null;
};

const formatWhen = (iso: string | null | undefined, timeZone: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(date);
};

/**
 * Who a person can start a conversation with: each booking's other party, named, with what the booking was and when,
 * newest first. A conversation belongs to one booking, so the choice is per booking and never shows an id.
 */
export const conversationOptions = (
  bookings: BookingLike[],
  other: "client" | "provider",
  timeZone = "Africa/Nairobi"
): ConversationOption[] =>
  bookings
    .filter((booking) => booking.id && booking[other]?.id)
    .map((booking) => {
      const party = booking[other];
      const iso = booking.scheduledAt ?? booking.createdAt ?? null;
      return {
        bookingId: String(booking.id),
        name: party?.fullName || party?.email || (other === "client" ? "Client" : "Provider"),
        service: booking.service?.name || "Appointment",
        when: formatWhen(iso, timeZone),
        sort: iso ? new Date(iso).getTime() : 0
      };
    })
    .sort((a, b) => b.sort - a.sort)
    .map(({ sort: _sort, ...option }) => option);
