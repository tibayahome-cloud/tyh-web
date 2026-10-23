import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import classNames from "classnames";

import { useRescheduleSlots } from "../hooks/useTelemedicine";
import { groupSlotsByDay, zoneDisplayName } from "../utils/timeSlots";
import { Button } from "./Button";

type Props = {
  bookingId: string;
  /** The chosen start as an ISO instant, or null while nothing is chosen. */
  value: string | null;
  onChange: (startAt: string | null) => void;
  /** Gives the radio groups a name a screen reader can announce. */
  label?: string;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600";

/** Moves focus and selection along a row of radios with the arrow keys, the way a native radio group behaves. */
const useRovingKeys = (count: number, select: (index: number) => void, current: number) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = current;
    if (event.key in keys) next = (current + keys[event.key] + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };
  return { refs, onKeyDown };
};

/**
 * Choosing another time for a consultation: pick a day, then one of the times that is really open.
 * Replaces typing a date into a calendar field, which let people offer times nobody could take.
 */
export const TimeSlotPicker = ({ bookingId, value, onChange, label = "New time" }: Props) => {
  const slotsQuery = useRescheduleSlots(bookingId);
  const timeZone = slotsQuery.data?.timezone ?? null;
  const days = useMemo(
    () => (timeZone && slotsQuery.data ? groupSlotsByDay(slotsQuery.data.slots, timeZone) : []),
    [slotsQuery.data, timeZone]
  );

  const [dayKey, setDayKey] = useState<string | null>(null);
  const selectedDay = days.find((day) => day.key === dayKey) ?? days.find((day) => day.slots.some((s) => s.startAt === value)) ?? days[0];

  // Keep a stale choice from surviving a refresh that no longer offers it.
  useEffect(() => {
    if (value && slotsQuery.data && !days.some((day) => day.slots.some((slot) => slot.startAt === value))) {
      onChange(null);
    }
  }, [days, onChange, slotsQuery.data, value]);

  const dayIndex = Math.max(0, days.findIndex((day) => day.key === selectedDay?.key));
  const dayKeys = useRovingKeys(days.length, (index) => setDayKey(days[index].key), dayIndex);
  const times = selectedDay?.slots ?? [];
  const timeIndex = Math.max(0, times.findIndex((slot) => slot.startAt === value));
  const timeKeys = useRovingKeys(times.length, (index) => onChange(times[index].startAt), timeIndex);

  if (slotsQuery.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading available times">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-14 w-16 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-11 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }

  if (slotsQuery.isError) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
        <p>We could not load the available times.</p>
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => slotsQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700" role="status">
        There are no free times in the next two weeks. Check the provider&apos;s availability, then try again.
      </p>
    );
  }

  const chosen = times.find((slot) => slot.startAt === value);

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label={`${label}: day`}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        onKeyDown={dayKeys.onKeyDown}
      >
        {days.map((day, index) => {
          const selected = day.key === selectedDay?.key;
          return (
            <button
              key={day.key}
              ref={(el) => {
                dayKeys.refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${day.longLabel}, ${day.slots.length} ${day.slots.length === 1 ? "time" : "times"}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setDayKey(day.key)}
              className={classNames(
                "flex min-h-[56px] min-w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border px-3 text-sm transition-colors motion-reduce:transition-none",
                focusRing,
                selected
                  ? "border-primary-700 bg-primary-700 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              )}
            >
              <span className="font-semibold">{day.weekday}</span>
              <span>{day.dayMonth}</span>
            </button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label={`${label}: time`} className="grid grid-cols-3 gap-2 sm:grid-cols-4" onKeyDown={timeKeys.onKeyDown}>
        {times.map((slot, index) => {
          const selected = slot.startAt === value;
          return (
            <button
              key={slot.startAt}
              ref={(el) => {
                timeKeys.refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!chosen && index === 0) ? 0 : -1}
              onClick={() => onChange(slot.startAt)}
              className={classNames(
                "min-h-[44px] rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors motion-reduce:transition-none",
                focusRing,
                selected
                  ? "border-primary-700 bg-primary-700 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              )}
            >
              {slot.time}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-slate-700" aria-live="polite">
        {chosen && selectedDay ? `${selectedDay.longLabel} at ${chosen.time}. ` : "Choose a day, then a time. "}
        {timeZone && `Shown in ${zoneDisplayName(timeZone)}.`}
      </p>
    </div>
  );
};
