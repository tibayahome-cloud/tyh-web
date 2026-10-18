import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { Input } from "../../../shared/components/Input";
import { Loading } from "../../../shared/components/Loading";
import { Modal } from "../../../shared/components/Modal";
import {
  assignFacilityAdmin,
  fetchFacilityAdminAccess,
  inviteFacilityAdmin,
  resendFacilityAdminInvitation,
  sendFacilityAdminPasswordReset,
  setFacilityAdminStatus,
  type FacilityAdminAccess
} from "../../../shared/libs/facilities";
import { classifyApiError } from "../../../shared/utils/errors";
import {
  describeRecoveryError,
  facilityAdminAccessState,
  type AccountLabel,
  type FacilityAccessLabel
} from "../../../shared/utils/facilityAdminAccess";
import { FacilityAdminProfileEditor } from "./FacilityAdminProfileEditor";

const ACCESS_CLASS: Record<FacilityAccessLabel, string> = {
  "Access active": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Access suspended": "bg-amber-50 text-amber-800 ring-amber-200",
  "Access removed": "bg-slate-100 text-slate-500 ring-slate-200"
};

const ACCOUNT_CLASS: Record<AccountLabel, string> = {
  "Setup pending": "bg-amber-50 text-amber-800 ring-amber-200",
  "Invitation expired": "bg-red-50 text-red-700 ring-red-200",
  "Account active": "bg-slate-50 text-slate-700 ring-slate-200",
  "Account suspended": "bg-red-50 text-red-700 ring-red-200"
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REASON_LIMIT = 500;

const when = (iso: string) => new Date(iso).toLocaleDateString();

type Props = { facilityId: string };
type EmailDialog = null | "invite" | "assign";

// Everything a super admin does about a facility's administrators, in one place. The page decides
// who sees it (super admin only) and the API enforces it again; a 403 here is shown as such.
export const FacilityAdministratorsSection = ({ facilityId }: Props) => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<FacilityAdminAccess | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<FacilityAdminAccess | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<FacilityAdminAccess | null>(null);
  const [reason, setReason] = useState("");
  const [emailDialog, setEmailDialog] = useState<EmailDialog>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Arriving from the facilities list's "Manage administrators" lands here.
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === "#facility-administrators") {
      sectionRef.current?.scrollIntoView?.({ block: "start" });
    }
  }, []);

  const queryKey = ["admin", "facilities", facilityId, "admins"];
  const adminsQuery = useQuery({ queryKey, queryFn: () => fetchFacilityAdminAccess(facilityId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const forbidden = adminsQuery.isError && classifyApiError(adminsQuery.error).category === "forbidden";

  const resendMutation = useMutation({
    mutationFn: (admin: FacilityAdminAccess) => resendFacilityAdminInvitation(facilityId, admin.userId),
    onSuccess: (_r, admin) => {
      setMessage(`A new setup invitation was sent to ${admin.email}.`);
      void refresh();
    },
    onError: (err) => setError(describeRecoveryError(err))
  });

  const resetMutation = useMutation({
    mutationFn: (admin: FacilityAdminAccess) => sendFacilityAdminPasswordReset(facilityId, admin.userId),
    onSuccess: (_r, admin) => {
      setMessage(`A password reset link was sent to ${admin.email}. It works once and expires in one hour.`);
      setResetTarget(null);
      void refresh();
    },
    onError: (err) => setError(describeRecoveryError(err))
  });

  const statusMutation = useMutation({
    mutationFn: ({ admin, suspend }: { admin: FacilityAdminAccess; suspend: boolean }) =>
      setFacilityAdminStatus(facilityId, admin.userId, suspend ? { status: "suspended", reason: reason.trim() } : { status: "active" }),
    onSuccess: (_r, { admin, suspend }) => {
      setMessage(
        suspend
          ? `Facility access for ${admin.email} is suspended. Their account and other access are unchanged.`
          : `Facility access for ${admin.email} is active again.`
      );
      setSuspendTarget(null);
      setReactivateTarget(null);
      setReason("");
      void refresh();
    },
    onError: (err) => {
      setError(describeRecoveryError(err));
      setSuspendTarget(null);
      setReactivateTarget(null);
    }
  });

  const emailMutation = useMutation({
    mutationFn: async (kind: "invite" | "assign") => {
      if (kind === "invite") await inviteFacilityAdmin(facilityId, email.trim());
      else await assignFacilityAdmin(facilityId, email.trim());
    },
    onSuccess: (_r, kind) => {
      setMessage(
        kind === "invite"
          ? `A setup invitation was sent to ${email.trim()}.`
          : `${email.trim()} now has admin access to this facility.`
      );
      setEmailDialog(null);
      setEmail("");
      void refresh();
    },
    onError: (err, kind) => {
      if (isAxiosError(err) && err.response?.status === 429) {
        setEmailError("Too many requests. Wait a few minutes and try again.");
        return;
      }
      const { message: text } = classifyApiError(err, "We could not save that. Try again.");
      setEmailError(
        kind === "invite" && isAxiosError(err) && err.response?.status === 409 && /already has an account/i.test(text)
          ? `${text} Use "Assign existing account" instead.`
          : text
      );
    }
  });

  const busy = resendMutation.isPending || resetMutation.isPending || statusMutation.isPending;
  const clear = () => {
    setMessage(null);
    setError(null);
  };

  const openEmailDialog = (kind: "invite" | "assign") => {
    clear();
    setEmail("");
    setEmailError(null);
    setEmailDialog(kind);
  };

  const submitEmail = () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    if (emailDialog) emailMutation.mutate(emailDialog);
  };

  const admins = adminsQuery.data ?? [];

  return (
    <section ref={sectionRef} id="facility-administrators" aria-labelledby="facility-administrators-heading" className="scroll-mt-20">
      <Card
        title={<span id="facility-administrators-heading">Administrators</span>}
        subtitle="Who can manage this facility, and the state of their access and account."
      >
        {!forbidden && (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button size="sm" variant="outline" onClick={() => openEmailDialog("assign")}>
              <PersonAddAlt1OutlinedIcon fontSize="small" aria-hidden="true" />
              Assign existing account
            </Button>
            <Button size="sm" onClick={() => openEmailDialog("invite")}>
              <PersonAddAltOutlinedIcon fontSize="small" aria-hidden="true" />
              Invite administrator
            </Button>
          </div>
        )}

        {adminsQuery.isLoading ? (
          <Loading />
        ) : forbidden ? (
          <p className="text-sm text-slate-700" role="alert">
            You do not have permission to manage this facility's administrators. Only a super admin can.
          </p>
        ) : adminsQuery.isError ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-danger-600" role="alert">
              {describeRecoveryError(adminsQuery.error)}
            </p>
            <Button size="sm" variant="outline" loading={adminsQuery.isFetching} onClick={() => void adminsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : admins.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-600">
            No administrators yet. Invite someone by email, or assign an existing account, to give them access to this facility.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Facility administrators">
            {admins.map((admin) => {
              const state = facilityAdminAccessState(admin);
              const removed = state.access === "Access removed";
              const editing = editingId === admin.id;
              return (
                <li
                  key={admin.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between ${removed ? "border-slate-100 bg-slate-50" : "border-slate-200"}`}
                >
                  {editing ? (
                    <FacilityAdminProfileEditor
                      facilityId={facilityId}
                      admin={admin}
                      onCancel={() => setEditingId(null)}
                      onSaved={(text) => {
                        setEditingId(null);
                        setError(null);
                        setMessage(text);
                        void refresh();
                      }}
                    />
                  ) : (
                    <>
                      <div className="min-w-0">
                        {admin.fullName && <p className="truncate text-sm font-semibold text-slate-900">{admin.fullName}</p>}
                        <p className={`break-words text-sm ${admin.fullName ? "text-slate-600" : "font-semibold text-slate-900"}`}>{admin.email}</p>
                        {admin.phone && (
                          <p className="text-sm text-slate-600">
                            {admin.phone}
                            {!admin.phoneVerifiedAt && <span className="ml-2 text-xs text-slate-500">Not verified</span>}
                          </p>
                        )}
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${ACCESS_CLASS[state.access]}`}>{state.access}</span>
                          {state.account && (
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${ACCOUNT_CLASS[state.account]}`}>{state.account}</span>
                          )}
                        </p>
                        {state.account === "Setup pending" && admin.invitation.expiresAt && (
                          <p className="mt-1 text-xs text-slate-500">Invitation expires {new Date(admin.invitation.expiresAt).toLocaleString()}</p>
                        )}
                        {state.account === "Invitation expired" && !removed && (
                          <p className="mt-1 text-xs text-slate-500">The invitation can no longer be used. Send a new one.</p>
                        )}
                        {state.access === "Access suspended" && (
                          <p className="mt-1 text-xs text-slate-600">
                            Facility access suspended{admin.suspendedAt ? ` ${when(admin.suspendedAt)}` : ""}
                            {admin.suspensionReason ? `. Reason: ${admin.suspensionReason}` : ""}. Their account and other access are unchanged.
                          </p>
                        )}
                        {removed && (
                          <p className="mt-1 text-xs text-slate-500">Removed{admin.removedAt ? ` ${when(admin.removedAt)}` : ""}. This assignment cannot be restored.</p>
                        )}
                        {admin.pendingEmail && !removed && (
                          <p className="mt-1 text-xs text-amber-800">
                            Waiting for {admin.pendingEmail} to be verified. {admin.email} stays the sign-in address until then.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {state.canEdit && (
                          <Button size="sm" variant="outline" disabled={busy} aria-label={`Edit details for ${admin.email}`} onClick={() => { clear(); setEditingId(admin.id); }}>
                            <EditOutlinedIcon fontSize="small" aria-hidden="true" />
                            Edit details
                          </Button>
                        )}
                        {state.canResendInvitation && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            loading={resendMutation.isPending && resendMutation.variables?.userId === admin.userId}
                            aria-label={`Resend setup invitation to ${admin.email}`}
                            onClick={() => { clear(); resendMutation.mutate(admin); }}
                          >
                            <RefreshOutlinedIcon fontSize="small" aria-hidden="true" />
                            Resend setup invitation
                          </Button>
                        )}
                        {state.canSendResetLink && (
                          <Button size="sm" variant="outline" disabled={busy} aria-label={`Send password reset link to ${admin.email}`} onClick={() => { clear(); setResetTarget(admin); }}>
                            <LockResetOutlinedIcon fontSize="small" aria-hidden="true" />
                            Send password reset link
                          </Button>
                        )}
                        {state.canSuspend && (
                          <Button size="sm" variant="outline" disabled={busy} aria-label={`Suspend facility access for ${admin.email}`} onClick={() => { clear(); setReason(""); setSuspendTarget(admin); }}>
                            <BlockOutlinedIcon fontSize="small" aria-hidden="true" />
                            Suspend access
                          </Button>
                        )}
                        {state.canReactivate && (
                          <Button size="sm" disabled={busy} aria-label={`Reactivate facility access for ${admin.email}`} onClick={() => { clear(); setReactivateTarget(admin); }}>
                            <RestoreOutlinedIcon fontSize="small" aria-hidden="true" />
                            Reactivate access
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {message && (
          <p className="mt-3 text-sm text-success-700" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
      </Card>

      <Modal
        open={emailDialog !== null}
        title={emailDialog === "invite" ? "Invite an administrator" : "Assign an existing account"}
        description={
          emailDialog === "invite"
            ? "For someone new to TYH. We create a pending account and email a one-time link to set a password."
            : "For someone who already has an active TYH account. They get admin access to this facility; no invitation is sent."
        }
        onClose={() => !emailMutation.isPending && setEmailDialog(null)}
        maxWidth="sm"
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submitEmail();
          }}
        >
          <Input label="Email address" type="email" name="administrator-email" autoFocus value={email} error={emailError ?? undefined} placeholder="admin@facility.example" onChange={(e) => { setEmail(e.target.value); setEmailError(null); }} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={emailMutation.isPending} onClick={() => setEmailDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={emailMutation.isPending}>
              {emailDialog === "invite" ? "Send invitation" : "Assign account"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        title="Suspend facility access?"
        description={suspendTarget ? `${suspendTarget.email} will lose admin access to this facility only. Their account, other access and sign-in are not changed. You can reactivate access later.` : undefined}
        confirmLabel="Suspend access"
        loading={statusMutation.isPending}
        confirmDisabled={!reason.trim()}
        onConfirm={() => suspendTarget && statusMutation.mutate({ admin: suspendTarget, suspend: true })}
        onClose={() => !statusMutation.isPending && setSuspendTarget(null)}
      >
        <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Reason (required)</span>
          <textarea
            className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
            value={reason}
            maxLength={REASON_LIMIT}
            onChange={(e) => setReason(e.target.value)}
          />
          <span className="text-xs text-slate-500">{reason.length}/{REASON_LIMIT}. Recorded in the audit log and shown on this page.</span>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(reactivateTarget)}
        title="Reactivate facility access?"
        description={reactivateTarget ? `${reactivateTarget.email} will be able to manage this facility again. Nothing else about their account changes.` : undefined}
        confirmLabel="Reactivate access"
        loading={statusMutation.isPending}
        onConfirm={() => reactivateTarget && statusMutation.mutate({ admin: reactivateTarget, suspend: false })}
        onClose={() => !statusMutation.isPending && setReactivateTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Send password reset link?"
        description={resetTarget ? `This emails ${resetTarget.email} a link that works once and expires in one hour, and signs them out everywhere now. Any earlier reset link stops working.` : undefined}
        confirmLabel="Send reset link"
        loading={resetMutation.isPending}
        error={resetMutation.isError ? error ?? undefined : undefined}
        onConfirm={() => resetTarget && resetMutation.mutate(resetTarget)}
        onClose={() => !resetMutation.isPending && setResetTarget(null)}
      />
    </section>
  );
};
