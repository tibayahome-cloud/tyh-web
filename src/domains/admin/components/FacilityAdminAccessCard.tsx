import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { Loading } from "../../../shared/components/Loading";
import {
  fetchFacilityAdminAccess,
  resendFacilityAdminInvitation,
  sendFacilityAdminPasswordReset,
  type FacilityAdminAccess
} from "../../../shared/libs/facilities";
import { describeRecoveryError, facilityAdminAccessState } from "../../../shared/utils/facilityAdminAccess";

const LABEL_CLASS: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-800 ring-amber-200",
  Expired: "bg-red-50 text-red-700 ring-red-200",
  "Account active": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Suspended: "bg-slate-100 text-slate-700 ring-slate-300",
  Removed: "bg-slate-100 text-slate-500 ring-slate-200"
};

const STATE_NOTE: Record<string, string> = {
  Expired: "The invitation can no longer be used. Send a new one.",
  Suspended: "This account is suspended. Reactivate it before sending a setup invitation or reset link.",
  Removed: "This administrator was removed from the facility."
};

type Props = { facilityId: string };

// Recovery for a facility's administrator, for super admins only (the page that renders this
// checks that; the API enforces it). An account still waiting to finish setup gets a setup
// invitation; one that is already active gets a password reset link.
export const FacilityAdminAccessCard = ({ facilityId }: Props) => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<FacilityAdminAccess | null>(null);

  const adminsQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "admins"],
    queryFn: () => fetchFacilityAdminAccess(facilityId)
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId, "admins"] });

  const resendMutation = useMutation({
    mutationFn: (admin: FacilityAdminAccess) => resendFacilityAdminInvitation(facilityId, admin.userId),
    onSuccess: (_result, admin) => {
      setMessage(`A new setup invitation was sent to ${admin.email}.`);
      void refresh();
    },
    onError: (err) => setError(describeRecoveryError(err))
  });

  const resetMutation = useMutation({
    mutationFn: (admin: FacilityAdminAccess) => sendFacilityAdminPasswordReset(facilityId, admin.userId),
    onSuccess: (_result, admin) => {
      setMessage(`A password reset link was sent to ${admin.email}. It works once and expires in one hour.`);
      setResetTarget(null);
      void refresh();
    },
    onError: (err) => setError(describeRecoveryError(err))
  });

  const busy = resendMutation.isPending || resetMutation.isPending;

  return (
    <Card
      title="Facility administrator access"
      subtitle="Send a setup invitation to an account that has not finished setup, or a password reset link to an active one."
    >
      {adminsQuery.isLoading ? (
        <Loading />
      ) : adminsQuery.isError ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-danger-600" role="alert">
            {describeRecoveryError(adminsQuery.error)}
          </p>
          <Button size="sm" variant="outline" loading={adminsQuery.isFetching} onClick={() => void adminsQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : adminsQuery.data?.length ? (
        <div className="space-y-3">
          {adminsQuery.data.map((admin) => {
            const state = facilityAdminAccessState(admin);
            return (
              <div
                key={admin.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <EmailOutlinedIcon className="mt-0.5 text-tiba-blue" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{admin.email}</p>
                    <p className="mt-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${LABEL_CLASS[state.label]}`}
                      >
                        {state.label}
                      </span>
                    </p>
                    {state.label === "Pending" && admin.invitation.expiresAt && (
                      <p className="mt-1 text-xs text-slate-500">
                        Invitation expires {new Date(admin.invitation.expiresAt).toLocaleString()}
                      </p>
                    )}
                    {STATE_NOTE[state.label] && <p className="mt-1 text-xs text-slate-500">{STATE_NOTE[state.label]}</p>}
                  </div>
                </div>
                {state.canResendInvitation && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    loading={resendMutation.isPending && resendMutation.variables?.userId === admin.userId}
                    onClick={() => {
                      setMessage(null);
                      setError(null);
                      resendMutation.mutate(admin);
                    }}
                  >
                    <RefreshOutlinedIcon fontSize="small" aria-hidden="true" />
                    Resend setup invitation
                  </Button>
                )}
                {state.canSendResetLink && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setMessage(null);
                      setError(null);
                      setResetTarget(admin);
                    }}
                  >
                    <LockResetOutlinedIcon fontSize="small" aria-hidden="true" />
                    Send password reset link
                  </Button>
                )}
              </div>
            );
          })}
          {message && (
            <p className="text-sm text-success-700" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="text-sm text-danger-600" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-600">No active facility administrator is assigned.</p>
      )}

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Send password reset link?"
        description={
          resetTarget
            ? `This emails ${resetTarget.email} a link that works once and expires in one hour, and signs them out everywhere now. Any earlier reset link stops working.`
            : undefined
        }
        confirmLabel="Send reset link"
        loading={resetMutation.isPending}
        error={resetMutation.isError ? error ?? undefined : undefined}
        onConfirm={() => resetTarget && resetMutation.mutate(resetTarget)}
        onClose={() => {
          if (!resetMutation.isPending) {
            setResetTarget(null);
          }
        }}
      />
    </Card>
  );
};
