import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { api } from "../../../../shared/libs/api";
import { getApiError } from "../../../../shared/utils/errors";
import { weekdayName, type AvailabilityWindowInput } from "../../../../shared/utils/providerAvailability";
import {
  DELIVERY_MODES,
  WEEKDAY_ORDER,
  blankWindow,
  sameSchedule,
  toAvailabilityPayload,
  validateWindows,
  windowsToEditable,
  type DeliveryMode,
  type EditableWindow
} from "../../../../shared/utils/providerScheduleEdit";
import { ProviderAvailabilityCard } from "../ProviderAvailabilityCard";

type Props = {
  userId: string;
  providerName: string;
  windows: Array<AvailabilityWindowInput & { slotDurationMinutes?: number | null }>;
  timezone: string | null;
  // False when the admin may look but not change (no provider:verify).
  canEdit: boolean;
  onSaved: () => void;
};

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/30";

// The weekly hours as a read-only summary, with an Edit mode for a super admin helping a provider who
// cannot update it themselves. Saving replaces the schedule and the provider is notified.
export const ProviderScheduleEditor = ({ userId, providerName, windows, timezone, canEdit, onSaved }: Props) => {
  const original = useMemo(() => windowsToEditable(windows), [windows]);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EditableWindow[]>(original);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setRows(original);
  }, [original, editing]);

  const errors = useMemo(() => validateWindows(rows), [rows]);
  const hasErrors = Object.keys(errors).length > 0;
  const changed = !sameSchedule(rows, original);

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/providers/${userId}/availability`, toAvailabilityPayload(rows));
    },
    onSuccess: () => {
      setConfirming(false);
      setEditing(false);
      setSaveError(null);
      onSaved();
    },
    onError: (error: unknown) => {
      setConfirming(false);
      setSaveError(getApiError(error, "We could not save the schedule. Nothing was changed."));
    }
  });

  const update = (key: string, patch: Partial<EditableWindow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  if (!editing) {
    return (
      <div>
        <ProviderAvailabilityCard windows={windows} timezone={timezone} />
        {canEdit && (
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => { setRows(original); setSaveError(null); setEditing(true); }}>
              Edit weekly hours
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card
      title="Edit weekly hours"
      description={`Editing on behalf of ${providerName}${timezone ? `. Times are ${timezone} time` : ""}. ${providerName} is notified when you save.`}
    >
      <div className="space-y-4">
        {WEEKDAY_ORDER.map((weekday) => {
          const dayRows = rows.filter((row) => row.weekday === weekday);
          return (
            <fieldset key={weekday} className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-sm font-semibold text-slate-900">{weekdayName(weekday)}</legend>
              {dayRows.length === 0 && <p className="text-sm text-slate-500">Not available.</p>}
              <ul className="space-y-2">
                {dayRows.map((row) => (
                  <li key={row.key}>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`${row.key}-start`}>{`${weekdayName(weekday)} start time`}</label>
                      <input id={`${row.key}-start`} type="time" className={inputClass} value={row.start} onChange={(e) => update(row.key, { start: e.target.value })} aria-invalid={Boolean(errors[row.key])} />
                      <span className="text-sm text-slate-500" aria-hidden="true">to</span>
                      <label className="sr-only" htmlFor={`${row.key}-end`}>{`${weekdayName(weekday)} end time`}</label>
                      <input id={`${row.key}-end`} type="time" className={inputClass} value={row.end} onChange={(e) => update(row.key, { end: e.target.value })} aria-invalid={Boolean(errors[row.key])} />
                      <label className="sr-only" htmlFor={`${row.key}-mode`}>{`${weekdayName(weekday)} delivery mode`}</label>
                      <select id={`${row.key}-mode`} className={inputClass} value={row.mode} onChange={(e) => update(row.key, { mode: e.target.value as DeliveryMode })}>
                        {DELIVERY_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>{mode.label}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="ghost" aria-label={`Remove ${weekdayName(weekday)} window ${row.start} to ${row.end}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                        Remove
                      </Button>
                    </div>
                    {errors[row.key] && <p className="mt-1 text-xs text-danger-600" role="alert">{errors[row.key]}</p>}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={() => setRows((current) => [...current, blankWindow(weekday)])}>
                  Add a window
                </Button>
              </div>
            </fieldset>
          );
        })}
      </div>
      {saveError && <p className="mt-4 text-sm text-danger-600" role="alert">{saveError}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => { setEditing(false); setRows(original); setSaveError(null); }} disabled={save.isPending}>
          Cancel
        </Button>
        <Button disabled={!changed || hasErrors} onClick={() => setConfirming(true)}>
          Save weekly hours
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Save weekly hours"
        description={`This replaces ${providerName}'s weekly schedule and tells them an administrator changed it.`}
        confirmLabel="Save and notify"
        loading={save.isPending}
        onConfirm={() => save.mutate()}
        onClose={() => setConfirming(false)}
      />
    </Card>
  );
};
