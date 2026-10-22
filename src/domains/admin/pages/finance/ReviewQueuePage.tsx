import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
  fetchReviewQueue,
  resolveReviewItem,
  type ReviewCategory,
  type ReviewItem
} from "../../../../shared/libs/telemedicineOps";
import { getApiError } from "../../../../shared/utils/errors";
import {
  ANSWERED_ELSEWHERE,
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_TONE,
  ageOf,
  countByCategory,
  formatMoney,
  oldestFirst,
  outcomeEffect
} from "../../utils/reviewQueue";

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }) : "";

const ResolveForm = ({ item, onDone, onCancel }: { item: ReviewItem; onDone: (message: string) => void; onCancel: () => void }) => {
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isRefund = outcome === "refund_full";

  const resolve = useMutation({
    mutationFn: () =>
      resolveReviewItem(item.category, item.id, {
        reason,
        outcome,
        refundAmountCents: isRefund ? item.refundableAmountCents : null
      }),
    onSuccess: (result) => {
      const refund = result?.refund;
      onDone(
        refund?.requested && refund.amount_cents != null
          ? `Refund of ${formatMoney(refund.amount_cents, refund.currency)} requested`
          : refund?.already_requested
            ? "A refund was already requested for this payment"
            : "Marked as resolved"
      );
    },
    onError: (err: unknown) => setError(getApiError(err, "Could not resolve this item"))
  });

  const submitLabel = isRefund && item.refundableAmountCents != null
    ? `Refund ${formatMoney(item.refundableAmountCents, item.refundableCurrency)} and close`
    : "Mark as resolved";

  return (
    <form
      className="mt-4 space-y-4 border-t border-slate-100 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        resolve.mutate();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-900">What did you decide?</legend>
        {item.outcomes.map((option) => (
          <label
            key={option.key}
            className={`flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              outcome === option.key ? "border-tiba-blue bg-sky-50" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={`outcome-${item.id}`}
              value={option.key}
              checked={outcome === option.key}
              onChange={() => setOutcome(option.key)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
              <span className="block text-sm text-slate-700">{outcomeEffect(item, option.key)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold text-slate-900">Note for the record</span>
        <textarea
          value={reason}
          rows={2}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What did you do, and why?"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" className="min-h-[44px]" disabled={!outcome || !reason.trim()} loading={resolve.isPending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" className="min-h-[44px]" onClick={onCancel} disabled={resolve.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

/**
 * Reviews: the things that need a person to decide. A payment that is held, an appointment that was paid for and then
 * cancelled, a visit nobody attended, a technical problem, a client's complaint. Closing one records who decided, what
 * they decided and why. Scope comes from the backend: a facility administrator sees only their own facility.
 */
export const ReviewQueuePage = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewCategory | "all">("all");
  const now = Date.now();

  const queueQuery = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => fetchReviewQueue()
  });

  const all = useMemo(() => oldestFirst(queueQuery.data ?? []), [queueQuery.data]);
  const counts = useMemo(() => countByCategory(all), [all]);
  const items = filter === "all" ? all : all.filter((item) => item.category === filter);
  const kinds = CATEGORIES.filter((category) => counts[category] > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Reviews</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">
          Things that need a person to decide, such as a held payment, a paid appointment that was cancelled, a missed
          appointment or a technical problem. Closing one records what you decided and why.
        </p>
      </header>

      {queueQuery.isError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">We could not load the reviews.</p>
          <Button type="button" size="sm" variant="secondary" className="mt-2 min-h-[44px]" onClick={() => queueQuery.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {all.length > 0 && (
        <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-2">
          {(["all", ...kinds] as Array<ReviewCategory | "all">).map((value) => {
            const selected = filter === value;
            const count = value === "all" ? all.length : counts[value];
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(value)}
                className={`min-h-[44px] rounded-full px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue ${
                  selected ? "bg-tiba-blue text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
              >
                {value === "all" ? "Everything" : CATEGORY_LABEL[value]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {queueQuery.isLoading && <p className="text-sm text-slate-700">Loading reviews…</p>}

      {!queueQuery.isLoading && !queueQuery.isError && all.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-700">
          Nothing needs a decision right now.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const elsewhere = ANSWERED_ELSEWHERE[item.category];
          const key = `${item.category}:${item.id}`;
          const age = ageOf(item.openedAt, now);
          const people = [item.clientName && `Client ${item.clientName}`, item.providerName && `Provider ${item.providerName}`]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={key} className={`rounded-2xl border bg-white p-4 ${age.overdue ? "border-amber-300" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${CATEGORY_TONE[item.category]}`}>
                  {CATEGORY_LABEL[item.category]}
                </span>
                <span className={`text-sm ${age.overdue ? "font-semibold text-amber-900" : "text-slate-700"}`}>{age.label}</span>
              </div>

              <p className="mt-2 text-base font-semibold text-slate-900">{item.serviceName ?? "Appointment"}</p>
              {people && <p className="text-sm text-slate-700">{people}</p>}
              <p className="text-sm text-slate-700">Appointment {formatWhen(item.scheduledAt) || "time not set"}</p>
              {item.summary && <p className="mt-2 text-sm text-slate-800">{item.summary}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.bookingId && (
                  <Link
                    to={`/admin/bookings/${item.bookingId}`}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                  >
                    Open booking
                  </Link>
                )}
                {!elsewhere && openItem !== key && (
                  <Button type="button" variant="secondary" className="min-h-[44px]" onClick={() => setOpenItem(key)}>
                    Resolve
                  </Button>
                )}
              </div>

              {elsewhere && <p className="mt-3 text-sm text-slate-800">{elsewhere}</p>}

              {!elsewhere && openItem === key && (
                <ResolveForm
                  item={item}
                  onCancel={() => setOpenItem(null)}
                  onDone={(message) => {
                    setOpenItem(null);
                    toast.showToast({ title: message, variant: "success" });
                    queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }).catch(() => undefined);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ReviewQueuePage;
