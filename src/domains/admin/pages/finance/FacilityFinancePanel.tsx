import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import ApiErrorBanner from "../../../../shared/components/ApiErrorBanner";
import { useToast } from "../../../../shared/components/ToastProvider";
import { classifyApiError } from "../../../../shared/utils/errors";
import { fetchReviewQueue } from "../../../../shared/libs/telemedicineOps";
import {
  fetchFacilityEarningsSummary,
  requestFacilityPayoutDestination,
  requestFacilityWithdrawal,
  verifyFacilityPayoutDestination
} from "../../../../shared/libs/wallet";
import { getWithdrawalStatusLabel, getWithdrawalStatusTone } from "./paymentStatus";

const formatKES = (cents: number | undefined | null) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(
    (cents ?? 0) / 100
  );

const formatDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "—");

const WalletStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-3">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
  </div>
);

/**
 * Compact facility finance workspace: wallet position, payout destination, withdrawal
 * action, and a link into the facility-scoped review queue. Payment transaction history
 * and provider-payout monitoring live in the payments table this panel sits above --
 * duplicating them here would just be two views of the same rows.
 */
export const FacilityFinancePanel = ({
  facilityId,
  facilityName,
  canManageFunds
}: {
  facilityId: string;
  facilityName?: string | null;
  canManageFunds: boolean;
}) => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [destinationPhone, setDestinationPhone] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [destinationRequested, setDestinationRequested] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const walletQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "wallet"],
    queryFn: () => fetchFacilityEarningsSummary(facilityId)
  });

  const reviewQueueQuery = useQuery({
    queryKey: ["admin", "finance", "reviews", "facility-count"],
    queryFn: () => fetchReviewQueue()
  });

  const openReviewCount = (reviewQueueQuery.data ?? []).filter(
    (item) => item.status === "open" && (item.facilityId === facilityId || item.facilityId === null)
  ).length;

  const invalidateWallet = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId, "wallet"] });

  const withdrawMutation = useMutation({
    mutationFn: (amountCents: number) => requestFacilityWithdrawal(facilityId, amountCents),
    onSuccess: () => {
      toast.showToast({ title: "Withdrawal requested", description: "The payout is being processed.", variant: "success" });
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      invalidateWallet();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to request withdrawal",
        description: error instanceof Error ? error.message : "Try again later.",
        variant: "error"
      });
    }
  });

  const destinationRequestMutation = useMutation({
    mutationFn: (phoneNumber: string) => requestFacilityPayoutDestination(facilityId, phoneNumber),
    onSuccess: (result) => {
      setDestinationRequested(true);
      toast.showToast({
        title: result.verified ? "Number already verified" : "Verification code sent",
        description: result.verified
          ? "This number can be used for facility withdrawals."
          : `Check ${result.phone_masked ?? "the number"} for the one-time code.`,
        variant: "success"
      });
    },
    onError: (error: unknown) =>
      toast.showToast({
        title: "Unable to send code",
        description: error instanceof Error ? error.message : "Try again later.",
        variant: "error"
      })
  });

  const destinationVerifyMutation = useMutation({
    mutationFn: () => verifyFacilityPayoutDestination(facilityId, destinationPhone.trim(), destinationCode.trim()),
    onSuccess: () => {
      toast.showToast({ title: "Payout number verified", description: "This is now the active payout destination.", variant: "success" });
      setDestinationPhone("");
      setDestinationCode("");
      setDestinationRequested(false);
      setDestinationModalOpen(false);
      invalidateWallet();
    },
    onError: (error: unknown) =>
      toast.showToast({
        title: "Code not accepted",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      })
  });

  const wallet = walletQuery.data;
  const availableCents = Math.max(wallet?.availableBalanceCents ?? 0, 0);

  const handleSubmitWithdrawal = () => {
    const amount = Number.parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.showToast({ title: "Enter a valid amount", description: "Amount must be greater than zero.", variant: "error" });
      return;
    }
    const amountCents = Math.round(amount * 100);
    if (amountCents > availableCents) {
      toast.showToast({
        title: "Amount exceeds available balance",
        description: `Available balance is ${formatKES(availableCents)}.`,
        variant: "error"
      });
      return;
    }
    if (!wallet?.payoutDestination?.verified) {
      toast.showToast({
        title: "Verify a payout destination first",
        description: "Add and verify a payout number before requesting a withdrawal.",
        variant: "error"
      });
      return;
    }
    withdrawMutation.mutate(amountCents);
  };

  return (
    <Card
      title={facilityName ? `Finance — ${facilityName}` : "Facility finance"}
      description="Wallet position, payout destination, and withdrawals for this facility."
    >
      {walletQuery.isLoading ? (
        <Loading />
      ) : walletQuery.isError ? (
        <ApiErrorBanner
          {...classifyApiError(walletQuery.error, "We could not load the facility wallet right now.")}
          onRetry={() => walletQuery.refetch()}
        />
      ) : (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <WalletStat label="Available" value={formatKES(wallet?.availableBalanceCents)} />
            <WalletStat label="Pending" value={formatKES(wallet?.pendingEarningsCents)} />
            <WalletStat label="Paid out" value={formatKES(wallet?.paidOutTotalCents)} />
            <WalletStat label="Reversed" value={formatKES(wallet?.reversedTotalCents)} />
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3">
            <div className="text-sm">
              <span className="font-semibold text-slate-900">Payout destination: </span>
              {wallet?.payoutDestination ? (
                <>
                  <span className="text-slate-600">{wallet.payoutDestination.phoneMasked ?? "—"}</span>
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${wallet.payoutDestination.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {wallet.payoutDestination.verified ? "Verified" : "Pending verification"}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">Not set</span>
              )}
            </div>
            {canManageFunds && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDestinationModalOpen(true)}>
                  {wallet?.payoutDestination ? "Change destination" : "Add destination"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={availableCents <= 0}
                  onClick={() => setWithdrawDialogOpen(true)}
                >
                  Request withdrawal
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryModalOpen(true)}>
                  Withdrawal history
                </Button>
              </div>
            )}
          </section>

          <section>
            <Link
              to="/admin/finance/reviews"
              className="inline-flex items-center gap-2 text-sm font-semibold text-tiba-blue hover:underline"
            >
              Review &amp; disputes
              {openReviewCount > 0 && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                  {openReviewCount} open
                </span>
              )}
            </Link>
          </section>
        </div>
      )}

      {/* ── Payout destination modal ───────────────────────────────────────── */}
      <Modal
        open={destinationModalOpen}
        onClose={() => setDestinationModalOpen(false)}
        title="Set or change payout number"
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input
              label="M-Pesa payout number"
              type="tel"
              placeholder="07xx xxx xxx"
              value={destinationPhone}
              onChange={(event) => {
                setDestinationPhone(event.target.value);
                setDestinationRequested(false);
                setDestinationCode("");
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!destinationPhone.trim()}
              loading={destinationRequestMutation.isPending}
              onClick={() => destinationRequestMutation.mutate(destinationPhone.trim())}
            >
              Send code
            </Button>
          </div>
          {destinationRequested && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="Verification code"
                inputMode="numeric"
                value={destinationCode}
                onChange={(event) => setDestinationCode(event.target.value)}
              />
              <Button
                type="button"
                disabled={!destinationCode.trim()}
                loading={destinationVerifyMutation.isPending}
                onClick={() => destinationVerifyMutation.mutate()}
              >
                Verify
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Withdrawal request confirmation ───────────────────────────────── */}
      <ConfirmDialog
        open={withdrawDialogOpen}
        title="Request facility withdrawal"
        description={`Available: ${formatKES(availableCents)}. Funds go to ${wallet?.payoutDestination?.phoneMasked ?? "the verified payout number"}.`}
        confirmLabel="Submit"
        onConfirm={handleSubmitWithdrawal}
        onClose={() => setWithdrawDialogOpen(false)}
        loading={withdrawMutation.isPending}
      >
        <Input
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          value={withdrawAmount}
          onChange={(event) => setWithdrawAmount(event.target.value)}
        />
      </ConfirmDialog>

      {/* ── Withdrawal history modal ───────────────────────────────────────── */}
      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title="Withdrawal history" maxWidth="md">
        {(wallet?.withdrawals.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">No withdrawals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2">Disbursed</th>
                  <th className="px-3 py-2">Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wallet?.withdrawals.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{formatKES(entry.amountCents)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${getWithdrawalStatusTone(entry.status)}`}>
                        {getWithdrawalStatusLabel(entry.status)}
                      </span>
                      {entry.failureReason && (
                        <p className="mt-1 max-w-xs text-xs text-rose-600">{entry.failureReason}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatDateTime(entry.requestedAt)}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDateTime(entry.disbursedAt)}</td>
                    <td className="px-3 py-2 text-slate-500">{entry.payoutPhoneMasked ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default FacilityFinancePanel;
