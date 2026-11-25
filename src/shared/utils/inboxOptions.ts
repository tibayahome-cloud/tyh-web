export type ConversationOption = {
  bookingId: string;
  /** The other person, by name. */
  name: string;
  /** What the latest visit or consultation was, e.g. "Wound dressing". */
  service: string;
  /** When it was, e.g. "21 Oct". */
  when: string;
  /** How many bookings the two share. */
  count: number;
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
 * Who a person can start a conversation with: one entry per person, however many bookings they share, newest person first.
 * A conversation belongs to a booking, so each entry carries the most recent booking with that person; the entry shows
 * what that booking was and when, and how many there are, never an id.
 */
export const conversationOptions = (
  bookings: BookingLike[],
  other: "client" | "provider",
  timeZone = "Africa/Nairobi"
): ConversationOption[] => {
  const people = new Map<string, ConversationOption & { sort: number }>();
  for (const booking of bookings) {
    const party = booking[other];
    if (!booking.id || !party?.id) continue;
    const iso = booking.scheduledAt ?? booking.createdAt ?? null;
    const sort = iso ? new Date(iso).getTime() : 0;
    const known = people.get(String(party.id));
    if (known) {
      known.count += 1;
      if (sort > known.sort) {
        known.bookingId = String(booking.id);
        known.service = booking.service?.name || "Appointment";
        known.when = formatWhen(iso, timeZone);
        known.sort = sort;
      }
      continue;
    }
    people.set(String(party.id), {
      bookingId: String(booking.id),
      name: party.fullName || party.email || (other === "client" ? "Client" : "Provider"),
      service: booking.service?.name || "Appointment",
      when: formatWhen(iso, timeZone),
      count: 1,
      sort
    });
  }
  return [...people.values()].sort((a, b) => b.sort - a.sort).map(({ sort: _sort, ...option }) => option);
};
