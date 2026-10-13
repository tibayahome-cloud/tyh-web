// Editing a provider's weekly hours on their behalf. The API replaces the whole schedule on save, so
// every field a row carries has to survive the round trip, including the delivery mode and slot
// length that the provider's own screen does not expose.

import { formatClock, type AvailabilityWindowInput } from "./providerAvailability";

export type DeliveryMode = "in_person" | "remote" | "both";

export type EditableWindow = {
  key: string;
  weekday: string;
  start: string;
  end: string;
  mode: DeliveryMode;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  slotDurationMinutes: number | null;
};

export const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DELIVERY_MODES: Array<{ value: DeliveryMode; label: string }> = [
  { value: "both", label: "Remote and in person" },
  { value: "remote", label: "Remote only" },
  { value: "in_person", label: "In person only" }
];

type WindowWithSlot = AvailabilityWindowInput & { slotDurationMinutes?: number | null };

const asMode = (mode: string | null): DeliveryMode => (mode === "remote" || mode === "in_person" ? mode : "both");

let counter = 0;
export const newWindowKey = () => `w${(counter += 1)}`;

export const windowsToEditable = (windows: WindowWithSlot[]): EditableWindow[] =>
  windows.map((window) => ({
    key: window.id || newWindowKey(),
    weekday: window.weekday.toLowerCase().slice(0, 3),
    // The local clock is what the slot engine reads, so that is what an admin edits.
    start: formatClock(window.startTimeLocal ?? window.startTime),
    end: formatClock(window.endTimeLocal ?? window.endTime),
    mode: asMode(window.deliveryMode),
    effectiveFrom: window.effectiveFrom,
    effectiveTo: window.effectiveTo,
    slotDurationMinutes: window.slotDurationMinutes ?? null
  }));

export const blankWindow = (weekday: string): EditableWindow => ({
  key: newWindowKey(),
  weekday,
  start: "09:00",
  end: "17:00",
  mode: "both",
  effectiveFrom: null,
  effectiveTo: null,
  slotDurationMinutes: null
});

const minutes = (clock: string): number => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

// One message per row key, so the screen can show it beside the row. Overnight windows are refused
// by the API (a row is one weekday), so they are refused here too, with the same advice.
export const validateWindows = (rows: EditableWindow[]): Record<string, string> => {
  const errors: Record<string, string> = {};
  rows.forEach((row) => {
    if (!/^\d{2}:\d{2}$/.test(row.start) || !/^\d{2}:\d{2}$/.test(row.end)) {
      errors[row.key] = "Enter a start and end time.";
    } else if (minutes(row.end) <= minutes(row.start)) {
      errors[row.key] = "End must be after start. Add a second window for the next day instead of running past midnight.";
    }
  });
  WEEKDAY_ORDER.forEach((weekday) => {
    const day = rows
      .filter((row) => row.weekday === weekday && !errors[row.key])
      .sort((a, b) => minutes(a.start) - minutes(b.start));
    day.forEach((row, index) => {
      const next = day[index + 1];
      if (next && minutes(next.start) < minutes(row.end)) {
        errors[next.key] = "This overlaps the window before it on the same day.";
      }
    });
  });
  return errors;
};

export const toAvailabilityPayload = (rows: EditableWindow[]) =>
  [...rows]
    .sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday as never) - WEEKDAY_ORDER.indexOf(b.weekday as never) || minutes(a.start) - minutes(b.start))
    .map((row) => ({
      weekday: row.weekday,
      start_time: row.start,
      end_time: row.end,
      delivery_mode: row.mode,
      effective_from: row.effectiveFrom,
      effective_to: row.effectiveTo,
      slot_duration_minutes: row.slotDurationMinutes
    }));

export const sameSchedule = (a: EditableWindow[], b: EditableWindow[]): boolean =>
  JSON.stringify(toAvailabilityPayload(a)) === JSON.stringify(toAvailabilityPayload(b));
