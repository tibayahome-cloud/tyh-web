import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchReviewQueue,
  resolveReviewItem,
  type ReviewCategory,
  type ReviewItem
} from "../../../../shared/libs/telemedicineOps";
import { Button } from "../../../../shared/components/Button";

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  payment_review: "Payment held",
  cancellation_payment_review: "Cancelled after paying",
  no_show: "Nobody attended",
  technical_issue: "Technical problem",
  reschedule_escalation: "Waiting on a reschedule answer"
};

const CATEGORY_TONE: Record<ReviewCategory, string> = {
  payment_review: "bg-amber-100 text-amber-800",
  cancellation_payment_review: "bg-amber-100 text-amber-800",
  no_show: "bg-rose-100 text-rose-700",
  technical_issue: "bg-slate-200 text-slate-700",
  reschedule_escalation: "bg-sky-100 text-sky-800"
};

/**
 * Items answered elsewhere, and where to go.
 *
 * A pending reschedule appears here so an operator can see it is waiting, but closing it from
 * the queue would leave the appointment unchanged and the client still waiting. The backend
 * refuses, so the interface points at the right place instead of offering a button that fails.
 */
const ANSWERED_ELSEWHERE: Partial<Record<ReviewCategory, string>> = {
  reschedule_escalation:
    "Open the booking to review the proposal; the client or provider must accept or decline it"
};

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

const ResolveForm = ({ item, onDone }: { item: ReviewItem; onDone: () => void }) => {
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resolve = useMutation({
    mutationFn: () => resolveReviewItem(item.category, item.id, reason, outcome || undefined),
    onSuccess: onDone,
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not resolve this item")
  });

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <input
        type="text"
        value={outcome}
        onChange={(event) => setOutcome(event.target.value)}
        placeholder="Outcome, e.g. rebooked, refund approved"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <textarea
        value={reason}
        rows={2}
        onChange={(event) => setReason(event.target.value)}
        placeholder="What did you do, and why?"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      {/* Required by the backend, so it is enforced here rather than after a round trip. An
          audit entry recording only that somebody closed something answers nothing useful. */}
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!reason.trim()}
          loading={resolve.isPending}
          onClick={() => resolve.mutate()}
        >
          Mark resolved
        </Button>
        <span className="text-xs text-slate-400">
          Recording a decision here does not move money.
        </span>
      </div>
    </div>
  );
};

/**
 * Everything awaiting an operator, in one place.
 *
 * Previously each kind of exception lived in its own table, so an operator had to know a
 * problem existed before they could find it. Scope comes from the backend: a facility
 * administrator sees only their own facility.
 */
export const ReviewQueuePage = () => {
  const queryClient = useQueryClient();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewCategory | "all">("all");

  const queueQuery = useQuery({
    queryKey: ["admin", "reviews", filter],
    queryFn: () => fetchReviewQueue(filter === "all" ? undefined : [filter])
  });

  const items = queueQuery.data ?? [];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Needs attention</h1>
        <p className="text-sm text-slate-500">
          Payments held, missed appointments, technical problems and unanswered reschedule
          requests, for your facility.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", ...Object.keys(CATEGORY_LABEL)] as Array<ReviewCategory | "all">).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === value ? "bg-tiba-blue text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {value === "all" ? "Everything" : CATEGORY_LABEL[value as ReviewCategory]}
          </button>
        ))}
      </div>

      {queueQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {!queueQuery.isLoading && items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Nothing needs attention right now.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const elsewhere = ANSWERED_ELSEWHERE[item.category];
          return (
            <li key={`${item.category}:${item.id}`} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_TONE[item.category]}`}>
                  {CATEGORY_LABEL[item.category]}
                </span>
                <span className="text-xs text-slate-400">opened {formatWhen(item.openedAt)}</span>
              </div>

              {item.summary && <p className="mt-2 text-sm text-slate-700">{item.summary}</p>}

              <p className="mt-1 text-xs text-slate-400">
                Appointment {formatWhen(item.scheduledAt) || "time unknown"}
                {item.paymentId ? " · payment attached" : ""}
              </p>

              {elsewhere ? (
                <p className="mt-3 text-sm text-slate-600">{elsewhere}</p>
              ) : openItem === `${item.category}:${item.id}` ? (
                <ResolveForm
                  item={item}
                  onDone={() => {
                    setOpenItem(null);
                    queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
                  }}
                />
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setOpenItem(`${item.category}:${item.id}`)}
                >
                  Resolve
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ReviewQueuePage;
