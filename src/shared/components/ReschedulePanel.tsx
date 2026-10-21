import { getApiError } from "../utils/errors";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptReschedule,
  cancelReschedule,
  declineReschedule,
  fetchRescheduleRequests,
  proposeReschedule,
  type RescheduleRequest
} from "../libs/telemedicineOps";
import { Button } from "./Button";
import { TimeSlotPicker } from "./TimeSlotPicker";

type Props = {
  bookingId: string;
  /** The viewer, so the panel can tell "your proposal" from "their proposal". */
  currentUserId: string;
  /** Hidden entirely once a consultation has started or finished. */
  canReschedule: boolean;
};

const STATUS_COPY: Record<RescheduleRequest["status"], string> = {
  pending: "Awaiting a response",
  accepted: "Accepted -- the appointment moved",
  declined: "Declined -- the appointment did not change",
  cancelled: "Withdrawn",
  expired: "Expired without an answer -- the appointment did not change",
  admin_approved: "Resolved by the care site -- the appointment moved"
};

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

/**
 * Proposing and answering a change of appointment time.
 *
 * The whole point of the panel is that a proposal is not a change. Until someone accepts, the
 * appointment shown everywhere else is still the real one, so this never displays the proposed
 * time as though it were confirmed -- the resolved states say explicitly whether the appointment
 * moved or did not.
 *
 * Which actions appear depends on who is looking. You may withdraw your own proposal but not
 * answer it; the other participant may accept or decline it, and the proposer is told either way.
 * The same answer can be given from the "Needs your response" card on the home and telemedicine
 * screens, which is where a proposal is noticed.
 */
export const ReschedulePanel = ({ bookingId, currentUserId, canReschedule }: Props) => {
  const queryClient = useQueryClient();
  const [proposedAt, setProposedAt] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["telemedicine", "reschedules", bookingId],
    queryFn: () => fetchRescheduleRequests(bookingId),
    enabled: Boolean(bookingId)
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["telemedicine", "reschedules", bookingId] });
    // The appointment time itself may have moved, so anything showing it is now stale.
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    // Answering here must clear the marker on the menu and the card, which read the same source.
    queryClient.invalidateQueries({ queryKey: ["telemedicine", "attention"] });
  };

  const propose = useMutation({
    mutationFn: () => proposeReschedule(bookingId, proposedAt as string, reason || undefined),
    onSuccess: () => {
      setProposedAt(null);
      setReason("");
      setError(null);
      refresh();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not propose that time")
  });

  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "cancel" | "decline" }) =>
      action === "accept"
        ? acceptReschedule(id)
        : action === "decline"
          ? declineReschedule(id)
          : cancelReschedule(id),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err: unknown) => setError(getApiError(err, "Could not respond"))
  });

  const requests = requestsQuery.data ?? [];
  const open = requests.find((request) => request.status === "pending");
  const history = requests.filter((request) => request.status !== "pending");
  const isMine = open ? String(open.requestedByUserId) === String(currentUserId) : false;

  if (!canReschedule && !open && history.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Change the time</h3>

      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}

      {open ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-sm text-slate-700">
            {isMine ? "You proposed" : "They proposed"} {formatWhen(open.proposedStartAt)}
          </p>
          {open.reason && <p className="mt-1 text-sm italic text-slate-600">&ldquo;{open.reason}&rdquo;</p>}
          {/* Said plainly, because a pending proposal is the moment someone is most likely to
              assume the appointment has already moved. */}
          <p className="mt-1 text-xs text-slate-500">
            Your appointment has not changed yet. It only moves if this is accepted.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {isMine ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={respond.isPending}
                onClick={() => respond.mutate({ id: open.id, action: "cancel" })}
              >
                Withdraw
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  loading={respond.isPending}
                  onClick={() => respond.mutate({ id: open.id, action: "accept" })}
                >
                  Accept this time
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={respond.isPending}
                  onClick={() => respond.mutate({ id: open.id, action: "decline" })}
                >
                  Decline
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        canReschedule && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-slate-700">Propose a new time</p>
            <TimeSlotPicker bookingId={bookingId} value={proposedAt} onChange={setProposedAt} label="Proposed time" />
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why? (optional)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={!proposedAt}
              loading={propose.isPending}
              onClick={() => propose.mutate()}
            >
              Send request
            </Button>
          </div>
        )
      )}

      {history.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {history.map((request) => (
            <li key={request.id} className="text-xs text-slate-500">
              {formatWhen(request.proposedStartAt)} — {STATUS_COPY[request.status]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
