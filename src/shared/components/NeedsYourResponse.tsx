import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "./Button";
import {
  useAcknowledgeAttention,
  useAnswerAttention,
  useTelemedicineAttention,
  type AttentionAnswer
} from "../hooks/useTelemedicineAttention";
import type { AttentionItem } from "../libs/telemedicineOps";
import { getApiError } from "../utils/errors";
import { formatTelemedicineDateTime } from "../utils/telemedicine";

type Props = {
  // Where "View booking" goes, since the client and provider apps have different routes.
  bookingPath: (bookingId: string) => string;
};

const headline = (item: AttentionItem): string => {
  if (item.kind === "time_confirmed") return `${item.serviceName} with ${item.fromName ?? "your client"} has a new confirmed time`;
  if (item.kind === "rebooking_offer") return `${item.fromName ?? "The care team"} offered a new time for your ${item.serviceName}`;
  return `${item.fromName ?? "The other person"} proposed a new time for ${item.serviceName}`;
};

const hint = (item: AttentionItem): string => {
  if (item.kind === "time_confirmed") return "The change is already confirmed. There is nothing you need to do.";
  return item.kind === "rebooking_offer"
    ? "You have already paid. If you accept, the consultation moves to this time and goes back to being assigned. If you decline, nothing is charged again and the payment stays for review."
    : "Nothing changes unless you accept. If you decline, the appointment stays as it is.";
};

// The things waiting on the signed-in person, answered where they are seen. Renders nothing when there is
// nothing to answer, so it costs the page no space.
export const NeedsYourResponse = ({ bookingPath }: Props) => {
  const query = useTelemedicineAttention();
  const answer = useAnswerAttention();
  const acknowledge = useAcknowledgeAttention();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  const items = query.data ?? [];
  if (items.length === 0) return null;

  const respond = (item: AttentionItem, choice: AttentionAnswer) => {
    setPending(`${item.id}:${choice}`);
    setErrors((current) => ({ ...current, [item.id]: "" }));
    answer.mutate(
      { item, answer: choice },
      {
        onError: (error) => setErrors((current) => ({ ...current, [item.id]: getApiError(error, "We could not send your answer. Try again.") })),
        onSettled: () => setPending(null)
      }
    );
  };

  // Only proposals need an answer; a confirmed new time is an update. A list of updates alone should not
  // claim the person owes a response.
  const answerable = items.filter((item) => item.kind !== "time_confirmed").length;
  const title = answerable > 0 ? "Needs your response" : "Updates";

  return (
    <section aria-labelledby="needs-response-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" />
        <h2 id="needs-response-heading" className="text-sm font-bold text-slate-900">
          {title}
          {items.length > 1 ? ` (${items.length})` : ""}
        </h2>
      </div>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`} className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
            <p className="text-sm font-semibold text-slate-900">{headline(item)}</p>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500">{item.kind === "time_confirmed" ? "New time" : "Proposed time"}</dt>
                <dd className="font-medium text-slate-900">{formatTelemedicineDateTime(item.proposedStartAt)}</dd>
              </div>
              {item.currentStartAt && item.kind !== "time_confirmed" && (
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Current time</dt>
                  <dd className="text-slate-700">{formatTelemedicineDateTime(item.currentStartAt)}</dd>
                </div>
              )}
              {item.expiresAt && (
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Answer by</dt>
                  <dd className="text-slate-700">{formatTelemedicineDateTime(item.expiresAt)}</dd>
                </div>
              )}
              {item.reason && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-slate-500">Reason</dt>
                  <dd className="text-slate-700">{item.reason}</dd>
                </div>
              )}
            </dl>
            <p className="mt-2 text-xs text-slate-600">{hint(item)}</p>
            {errors[item.id] && (
              <p className="mt-2 text-sm text-danger-600" role="alert">
                {errors[item.id]}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.kind === "time_confirmed" ? (
                <Button size="sm" loading={acknowledge.isPending && acknowledge.variables?.id === item.id} onClick={() => acknowledge.mutate(item)}>
                  Got it
                </Button>
              ) : (
                <>
                  <Button size="sm" loading={pending === `${item.id}:accept`} disabled={pending !== null} onClick={() => respond(item, "accept")}>
                    Accept new time
                  </Button>
                  <Button size="sm" variant="secondary" loading={pending === `${item.id}:decline`} disabled={pending !== null} onClick={() => respond(item, "decline")}>
                    Decline
                  </Button>
                </>
              )}
              <Link
                to={bookingPath(item.bookingId)}
                onClick={() => {
                  // Opening the booking is the other way to say it has been seen.
                  if (item.acknowledgeable) acknowledge.mutate(item);
                }}
                className="ml-auto text-sm font-medium text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
              >
                View booking
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
