// Weekly availability as an admin reads it: one row per weekday, Monday first, with the local times
// the slot engine actually uses.

export type AvailabilityWindowInput = {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  startTimeLocal: string | null;
  endTimeLocal: string | null;
  deliveryMode: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday"
};

export const weekdayName = (weekday: string): string => NAMES[weekday.toLowerCase().slice(0, 3)] ?? weekday;

// "08:00:00" and "08:00:00+03:00" both become "08:00".
export const formatClock = (value: string | null | undefined): string => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value ?? "";
};

export const deliveryModeLabel = (mode: string | null): string =>
  mode === "remote" ? "Remote" : mode === "in_person" ? "In person" : mode === "both" || mode === null ? "Remote and in person" : mode;

export type AvailabilityDay = {
  weekday: string;
  name: string;
  windows: Array<{ id: string; from: string; to: string; mode: string; remote: boolean; effective: string | null }>;
};

export const groupAvailabilityByDay = (windows: AvailabilityWindowInput[]): AvailabilityDay[] =>
  ORDER.map((weekday) => {
    const day = windows
      .filter((window) => window.weekday.toLowerCase().slice(0, 3) === weekday)
      .map((window) => {
        const from = formatClock(window.startTimeLocal ?? window.startTime);
        const to = formatClock(window.endTimeLocal ?? window.endTime);
        const mode = window.deliveryMode;
        const effective =
          window.effectiveFrom || window.effectiveTo
            ? [window.effectiveFrom ? `from ${new Date(window.effectiveFrom).toLocaleDateString()}` : null, window.effectiveTo ? `until ${new Date(window.effectiveTo).toLocaleDateString()}` : null]
                .filter(Boolean)
                .join(" ")
            : null;
        return { id: window.id, from, to, mode: deliveryModeLabel(mode), remote: mode === null || mode === "remote" || mode === "both", effective };
      })
      .sort((a, b) => a.from.localeCompare(b.from));
    return { weekday, name: NAMES[weekday], windows: day };
  });

export const remoteWindowCount = (windows: AvailabilityWindowInput[]): number =>
  windows.filter((window) => window.deliveryMode === null || window.deliveryMode === "remote" || window.deliveryMode === "both").length;
