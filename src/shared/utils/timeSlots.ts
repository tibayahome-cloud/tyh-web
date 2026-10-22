export type SlotInstant = { startAt: string; endAt: string };

export type SlotDay = {
  /** The calendar day in the facility's zone, as YYYY-MM-DD. */
  key: string;
  weekday: string;
  dayMonth: string;
  longLabel: string;
  slots: Array<SlotInstant & { time: string }>;
};

const dayKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/**
 * Groups instants into the facility's calendar days. The day a slot belongs to depends on the facility's zone, not the
 * viewer's: 23:30 in Nairobi is still the same evening on a laptop set to London, and must not slide into the next day.
 */
export const groupSlotsByDay = (slots: SlotInstant[], timeZone: string): SlotDay[] => {
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" });
  const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });
  const longLabel = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const days = new Map<string, SlotDay>();
  [...slots]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .forEach((slot) => {
      const start = new Date(slot.startAt);
      if (Number.isNaN(start.getTime())) return;
      const key = dayKey(start, timeZone);
      let day = days.get(key);
      if (!day) {
        day = {
          key,
          weekday: weekday.format(start),
          dayMonth: dayMonth.format(start),
          longLabel: longLabel.format(start),
          slots: []
        };
        days.set(key, day);
      }
      day.slots.push({ ...slot, time: time.format(start) });
    });
  return [...days.values()];
};

/** "Nairobi time" from "Africa/Nairobi", for a note a person can read. */
export const zoneDisplayName = (timeZone: string): string => {
  const city = timeZone.split("/").pop() ?? timeZone;
  return `${city.replace(/_/g, " ")} time`;
};
