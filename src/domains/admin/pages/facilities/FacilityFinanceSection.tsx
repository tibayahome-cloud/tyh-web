import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import ApiErrorBanner from "../../../../shared/components/ApiErrorBanner";
import { useToast } from "../../../../shared/components/ToastProvider";
import { classifyApiError } from "../../../../shared/utils/errors";
import { fetchFacilityPayments } from "../../../../shared/libs/payments";
import {
  fetchFacilityEarningsSummary,
  requestFacilityPayoutDestination,
  requestFacilityWithdrawal,
  verifyFacilityPayoutDestination
} from "../../../../shared/libs/wallet";
import type { PaymentRecord } from "../../../../shared/schemas/payment";

const formatKES = (cents: number | undefined | null) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(
    (cents ?? 0) / 100
  );

const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString() : "—";

const statusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (["succeeded", "disbursed", "paid", "completed"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (["pending", "requested", "disbursing", "processing"].includes(normalized)) {
    return "bg-amber-50 text-amber-700";
  }
  if (["failed", "rejected", "reversed"].includes(normalized)) {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
};

const WalletStat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

export const FacilityFinanceSection = ({
  facilityId,
  canManage
}: {
  facilityId: string;
  canManage: boolean;
}) => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [destinationPhone, setDestinationPhone] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [destinationRequested, setDestinationRequested] = useState(false);

  const walletQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "wallet"],
    queryFn: () => fetchFacilityEarningsSummary(facilityId),
    enabled: canManage
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "finance-payments"],
    queryFn: () => fetchFacilityPayments(facilityId, { page: 1, pageSize: 10 }),
    enabled: canManage
  });

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
      toast.showToast({ title: "Payout number verified", description: "This number is now the active payout destination.", variant: "success" });
      setDestinationPhone("");
      setDestinationCode("");
      setDestinationRequested(false);
      invalidateWallet();
    },
    onError: (error: unknown) =>
      toast.showToast({
        title: "Code not accepted",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      })
  });

  if (!canManage) {
    return null;
  }

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
      title="Facility finance"
      description="Wallet balance, payout destination, and withdrawal history for this facility."
      badge={wallet?.nextReleaseAt ? `Next release ${formatDateTime(wallet.nextReleaseAt)}` : undefined}
    >
      {walletQuery.isLoading ? (
        <Loading />
      ) : walletQuery.isError ? (
        <ApiErrorBanner
          {...classifyApiError(walletQuery.error, "We could not load the facility wallet right now.")}
          onRetry={() => walletQuery.refetch()}
        />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <WalletStat label="Available balance" value={formatKES(wallet?.availableBalanceCents)} />
            <WalletStat label="Pending earnings" value={formatKES(wallet?.pendingEarningsCents)} />
            <WalletStat label="Paid out" value={formatKES(wallet?.paidOutTotalCents)} />
            <WalletStat label="Reversed" value={formatKES(wallet?.reversedTotalCents)} />
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Payout destination</p>
              {wallet?.payoutDestination ? (
                <p className="mt-1 text-sm text-slate-600">
                  {wallet.payoutDestination.phoneMasked ?? "—"}{" "}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${wallet.payoutDestination.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {wallet.payoutDestination.verified ? "Verified" : "Pending verification"}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">No payout destination on file yet.</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("facility-payout-destination")?.scrollIntoView({ behavior: "smooth" })}
            >
              {wallet?.payoutDestination ? "Change destination" : "Add destination"}
            </Button>
          </section>

          <section id="facility-payout-destination" className="scroll-mt-6 space-y-3 rounded-2xl border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-900">Set or change payout number</p>
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
          </section>

          <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Available to withdraw: <span className="font-semibold text-slate-900">{formatKES(availableCents)}</span>
            </p>
            <Button
              type="button"
              disabled={availableCents <= 0}
              onClick={() => setWithdrawDialogOpen(true)}
              fullWidth
              className="sm:w-auto"
            >
              Request withdrawal
            </Button>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Withdrawal history</h3>
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
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(entry.status)}`}>
                            {entry.status}
                          </span>
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
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Recent payments</h3>
            <p className="mb-2 text-xs text-slate-500">
              Provider payout status shown here is for monitoring only.
            </p>
            {paymentsQuery.isLoading ? (
              <Loading />
            ) : paymentsQuery.isError ? (
              <ApiErrorBanner
                {...classifyApiError(paymentsQuery.error, "We could not load recent payments right now.")}
                onRetry={() => paymentsQuery.refetch()}
              />
            ) : (paymentsQuery.data?.payments.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Provider payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentsQuery.data?.payments.map((payment: PaymentRecord) => (
                      <tr key={payment.id}>
                        <td className="px-3 py-2 text-slate-900">{payment.bookingServiceName ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{payment.clientName ?? "—"}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{formatKES(payment.amountCents)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(payment.status)}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {payment.settlement ? formatKES(payment.settlement.providerPayoutCents) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

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
    </Card>
  );
};

export default FacilityFinanceSection;
