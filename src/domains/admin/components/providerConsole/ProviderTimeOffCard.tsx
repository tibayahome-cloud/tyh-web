import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { api } from "../../../../shared/libs/api";
import { getApiError } from "../../../../shared/utils/errors";

export type TimeOffEntry = { id: string; startAt: string; endAt: string; reason: string | null };

type Props = {
  userId: string;
  providerName: string;
  blackouts: TimeOffEntry[];
  canEdit: boolean;
  onChanged: () => void;
};

const fmt = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/30";

// Time off (blackouts) the provider will not take bookings in. Past entries are hidden: they cannot
// affect a booking any more and the list used to grow forever.
export const ProviderTimeOffCard = ({ userId, providerName, blackouts, canEdit, onChanged }: Props) => {
  const upcoming = useMemo(
    () => blackouts.filter((entry) => new Date(entry.endAt).getTime() >= Date.now()).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [blackouts]
  );
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState<TimeOffEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidRange = Boolean(start && end && new Date(end) <= new Date(start));
  const reset = () => {
    setAdding(false);
    setStart("");
    setEnd("");
    setReason("");
    setError(null);
  };

  const add = useMutation({
    mutationFn: () =>
      api.post(`/providers/${userId}/blackouts`, {
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        ...(reason.trim() ? { reason: reason.trim() } : {})
      }),
    onSuccess: () => {
      reset();
      onChanged();
    },
    onError: (e: unknown) => setError(getApiError(e, "We could not add the time off."))
  });

  const remove = useMutation({
    mutationFn: (entry: TimeOffEntry) => api.delete(`/providers/${userId}/blackouts/${entry.id}`),
    onSuccess: () => {
      setRemoving(null);
      onChanged();
    },
    onError: (e: unknown) => {
      setRemoving(null);
      setError(getApiError(e, "We could not remove the time off."));
    }
  });

  return (
    <Card title="Time off" description="Periods when this provider takes no bookings. Upcoming and current only.">
      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-600">No time off scheduled.</p>
      ) : (
        <ul className="space-y-2" aria-label="Upcoming time off">
          {upcoming.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-slate-900">
                  {fmt(entry.startAt)} to {fmt(entry.endAt)}
                </span>
                {entry.reason && <span className="ml-2 text-xs text-slate-500">{entry.reason}</span>}
              </span>
              {canEdit && (
                <Button size="sm" variant="ghost" aria-label={`Remove time off starting ${fmt(entry.startAt)}`} onClick={() => setRemoving(entry)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && !adding && <p className="mt-3 text-sm text-danger-600" role="alert">{error}</p>}
      {canEdit && !adding && (
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Add time off</Button>
        </div>
      )}
      {adding && (
        <form
          className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            add.mutate();
          }}
        >
          <p className="text-xs text-slate-600">Adding time off for {providerName}. They are notified.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Starts
              <input type="datetime-local" required className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="text-sm text-slate-700">
              Ends
              <input type="datetime-local" required className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={invalidRange} />
            </label>
          </div>
          {invalidRange && <p className="text-xs text-danger-600" role="alert">The end must be after the start.</p>}
          <label className="block text-sm text-slate-700">
            Reason (optional)
            <input type="text" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </label>
          {error && <p className="text-sm text-danger-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={reset} disabled={add.isPending}>Cancel</Button>
            <Button type="submit" loading={add.isPending} disabled={!start || !end || invalidRange}>Add time off</Button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove time off"
        description={removing ? `${providerName} will be bookable again from ${fmt(removing.startAt)} to ${fmt(removing.endAt)}, and is notified.` : undefined}
        confirmLabel="Remove time off"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onClose={() => setRemoving(null)}
      />
    </Card>
  );
};
