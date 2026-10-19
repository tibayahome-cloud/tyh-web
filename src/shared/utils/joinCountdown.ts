// How long until a consultation starts, in the words a person uses: "Starts in 2 h 15 min", "Starts in 12 min",
// "Starting now", "Started 5 min ago". Past a day it gives the date instead of a long count.
export const describeStart = (scheduledAt: string | null | undefined, now: number): string | null => {
  if (!scheduledAt) return null;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return null;

  const minutes = Math.round((start - now) / 60_000);
  if (minutes > 24 * 60) return null;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `Starts in ${hours} h` : `Starts in ${hours} h ${rest} min`;
  }
  if (minutes > 0) return `Starts in ${minutes} min`;
  if (minutes === 0) return "Starting now";
  return `Started ${Math.abs(minutes)} min ago`;
};
