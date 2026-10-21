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

// How long until the call opens, for the line under a consultation that is not open yet: "12 min", "3 h 17 min",
// "2 days". Minutes alone ("1544 min") are not something a person can read.
export const describeWait = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  if (total < 24 * 60) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.round(total / (24 * 60));
  return days === 1 ? "1 day" : `${days} days`;
};
