import type { TelemedicineAssignmentBooking } from "../../../shared/schemas/telemedicine";
import { describeStart } from "../../../shared/utils/joinCountdown";

// The facility admin's assignment queue, sorted by what the admin has to do. A request waiting for a provider is
// the job, so it comes first; an appointment that needs a new time is next; one already offered a replacement is
// waiting on the client and needs nothing from the admin, so it is last and quiet. Inside each group the
// appointment that starts soonest is first, because that is the one running out of time.

export type AssignmentQueueGroups = {
  assign: TelemedicineAssignmentBooking[];
  rebook: TelemedicineAssignmentBooking[];
  waiting: TelemedicineAssignmentBooking[];
};

const timeOf = (booking: TelemedicineAssignmentBooking): number => {
  const time = booking.scheduledAt ? new Date(booking.scheduledAt).getTime() : NaN;
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

const bySoonest = (a: TelemedicineAssignmentBooking, b: TelemedicineAssignmentBooking) => timeOf(a) - timeOf(b);

export const groupAssignmentQueue = (bookings: readonly TelemedicineAssignmentBooking[]): AssignmentQueueGroups => ({
  assign: bookings.filter((booking) => booking.recoveryState === "assignable").sort(bySoonest),
  rebook: bookings.filter((booking) => booking.recoveryState === "needs_rebooking").sort(bySoonest),
  waiting: bookings.filter((booking) => booking.recoveryState === "awaiting_client").sort(bySoonest)
});

export type Urgency = { label: string; tone: "overdue" | "soon" | "later" };

/**
 * How pressing a request is, in words. Started already: assign now. Within the hour: soon. Within a day: how long.
 * Further out: no tag, the date says it.
 */
export const requestUrgency = (booking: Pick<TelemedicineAssignmentBooking, "scheduledAt">, now: number): Urgency | null => {
  const text = describeStart(booking.scheduledAt, now);
  if (!text || !booking.scheduledAt) return null;
  const minutes = Math.round((new Date(booking.scheduledAt).getTime() - now) / 60_000);
  if (minutes <= 0) return { label: `${text}. Assign now`, tone: "overdue" };
  if (minutes <= 60) return { label: text, tone: "soon" };
  return { label: text, tone: "later" };
};
