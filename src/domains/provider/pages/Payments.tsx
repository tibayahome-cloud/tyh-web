import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Input } from "../../../shared/components/Input";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import ApiErrorBanner from "../../../shared/components/ApiErrorBanner";
import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
  usePayoutDestinationRequest,
  usePayoutDestinationVerification,
  useProviderEarningsSummary,
  useWalletAccount,
  useWalletWithdrawalRequest
} from "../../../shared/hooks/useWallet";
import { motion, AnimatePresence } from "framer-motion";
import { prefetchBooking } from "../../../shared/libs/query";
import { classifyApiError } from "../../../shared/utils/errors";
import { providerFinancialsAreVisible, useProviderProfile } from "../hooks/useProviderProfile";

const formatCurrency = (amountCents: number | undefined, currency = "KES") => {
  const value = typeof amountCents === "number" ? amountCents / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const StatsCardSkeleton = () => (
  <div className="animate-pulse-subtle rounded-2xl border border-neutral-100 bg-white/50 p-6 backdrop-blur-sm">
    <div className="h-3 w-24 rounded-md bg-neutral-100" />
    <div className="mt-3 h-8 w-32 rounded-md bg-neutral-100" />
  </div>
);

const TransactionSkeleton = () => (
  <div className="flex animate-pulse-subtle items-center justify-between py-4 border-b border-neutral-100/50">
    <div className="space-y-2">
      <div className="h-4 w-40 rounded-md bg-neutral-100" />
      <div className="h-3 w-24 rounded-md bg-neutral-100" />
    </div>
    <div className="h-4 w-20 rounded-md bg-neutral-100" />
  </div>
);

const ProviderPayments = () => {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useProviderProfile(user?.id);
  const financialsVisible = providerFinancialsAreVisible(profileQuery.data);
  const walletQuery = useWalletAccount({ enabled: !profileQuery.isLoading && financialsVisible });
  const earningsQuery = useProviderEarningsSummary({ enabled: !profileQuery.isLoading && financialsVisible });
  const withdrawMutation = useWalletWithdrawalRequest();
  const destinationRequestMutation = usePayoutDestinationRequest();
  const destinationVerificationMutation = usePayoutDestinationVerification();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutPhoneNumber, setPayoutPhoneNumber] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [destinationVerified, setDestinationVerified] = useState(false);
  const [destinationMasked, setDestinationMasked] = useState<string | null>(null);
  const wallet = walletQuery.data;
  const earnings = earningsQuery.data;
  const transactions = wallet?.transactions ?? [];
  const withdrawals = earnings?.withdrawals ?? wallet?.withdrawals ?? [];
  const availableToWithdrawCents = Math.max(
    earnings?.availableBalanceCents ?? (wallet?.balanceCents ?? 0) - (wallet?.pendingWithdrawalCents ?? 0),
    0
  );
  const pendingEarningsCents = earnings?.pendingEarningsCents ?? 0;
  const paidOutCents = earnings?.paidOutTotalCents ?? withdrawals
    .filter((entry) => entry.status.toLowerCase() === "disbursed" || entry.status.toLowerCase() === "succeeded")
    .reduce((total, entry) => total + entry.amountCents, 0);

  useEffect(() => {
    if (!profileQuery.isLoading && !financialsVisible) {
      navigate("/pro/home", { replace: true });
    }
  }, [financialsVisible, navigate, profileQuery.isLoading]);

  const handleWithdraw = () => {
    const amount = Number.parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.showToast({
        title: "Enter a valid amount",
        description: "Amount must be greater than zero.",
        variant: "error"
      });
      return;
    }
    if (payoutPhoneNumber.trim() && !destinationVerified) {
      toast.showToast({
        title: "Verify the payout number",
        description: "Verify the alternate M-Pesa number before submitting this withdrawal.",
        variant: "error"
      });
      return;
    }
    withdrawMutation
      .mutateAsync({
        amountCents: Math.round(amount * 100),
        payoutPhoneNumber: payoutPhoneNumber.trim() || undefined
      })
      .then(() => {
        toast.showToast({
          title: "Withdrawal requested",
          description: "Your withdrawal is being processed.",
          variant: "success"
        });
        setWithdrawAmount("");
        setPayoutPhoneNumber("");
        setDestinationCode("");
        setDestinationVerified(false);
        setDestinationMasked(null);
        setWithdrawDialogOpen(false);
      })
      .catch((error) => {
        toast.showToast({
          title: "Unable to request withdrawal",
          description: error instanceof Error ? error.message : "Try again later.",
          variant: "error"
        });
      });
  };

  const handleRequestDestinationCode = () => {
    const phoneNumber = payoutPhoneNumber.trim();
    if (!phoneNumber) {
      toast.showToast({ title: "Enter a payout number", description: "Add the M-Pesa number to verify.", variant: "error" });
      return;
    }
    destinationRequestMutation.mutate(phoneNumber, {
      onSuccess: (result) => {
        setDestinationMasked(result.phone_masked);
        setDestinationVerified(result.verified);
        toast.showToast({
          title: result.verified ? "Number already verified" : "Verification code sent",
          description: result.verified ? "You can use this number for the withdrawal." : "Check the number for the one-time code.",
          variant: "success"
        });
      },
      onError: (error) => toast.showToast({ title: "Unable to verify number", description: error instanceof Error ? error.message : "Try again later.", variant: "error" })
    });
  };

  const handleVerifyDestination = () => {
    destinationVerificationMutation.mutate(
      { phoneNumber: payoutPhoneNumber.trim(), code: destinationCode.trim() },
      {
        onSuccess: (result) => {
          setDestinationMasked(result.phone_masked);
          setDestinationVerified(result.verified);
          toast.showToast({ title: "Payout number verified", description: "This number can be used for the withdrawal.", variant: "success" });
        },
        onError: (error) => toast.showToast({ title: "Code not accepted", description: error instanceof Error ? error.message : "Try again.", variant: "error" })
      }
    );
  };

  if (profileQuery.isLoading || ((walletQuery.isLoading || earningsQuery.isLoading) && !wallet && !earnings && financialsVisible)) {
    return (
      <div className="space-y-8 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <TransactionSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (!financialsVisible) return null;

  if (walletQuery.isError && earningsQuery.isError) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">Payments & Wallet</h1>
          <p className="text-sm text-slate-500">Track your available funds and withdrawal history.</p>
        </header>
        <ApiErrorBanner
          {...classifyApiError(walletQuery.error, "We could not load your wallet right now.")}
          onRetry={() => {
            void walletQuery.refetch();
            void earningsQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Payments & Wallet</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setWithdrawDialogOpen(true)}
            disabled={!wallet || availableToWithdrawCents <= 0 || withdrawMutation.isLoading}
          >
            Request withdrawal
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => document.getElementById("withdrawals")?.scrollIntoView({ behavior: "smooth" })}
          >
            Wallet history
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <motion.article
          whileHover={{ y: -4 }}
          className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-card backdrop-blur-md ring-1 ring-black/[0.03] transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Available to withdraw</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {formatCurrency(availableToWithdrawCents, wallet?.currency)}
          </p>
        </motion.article>

        <motion.article
          whileHover={{ y: -4 }}
          className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-card backdrop-blur-md ring-1 ring-black/[0.03] transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Pending earnings</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {formatCurrency(pendingEarningsCents, earnings?.currency ?? wallet?.currency)}
          </p>
        </motion.article>

        <motion.article
          whileHover={{ y: -4 }}
          className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-card backdrop-blur-md ring-1 ring-black/[0.03] transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Paid out</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {formatCurrency(paidOutCents, earnings?.currency ?? wallet?.currency)}
          </p>
          <p className="mt-1 text-xs capitalize text-neutral-500">Wallet {wallet?.status ?? "—"}</p>
        </motion.article>
      </section>

      {earningsQuery.isError && (
        <ApiErrorBanner
          {...classifyApiError(earningsQuery.error, "Earnings details are temporarily unavailable.")}
          onRetry={() => earningsQuery.refetch()}
        />
      )}

      {earnings?.nextReleaseAt && (
        <p className="text-sm text-slate-500">
          Pending earnings release after the client review window. Next release: {new Date(earnings.nextReleaseAt).toLocaleString()}.
        </p>
      )}

      <Card
        title="Recent transactions"
        className="overflow-hidden border-none bg-white/70 shadow-elevated backdrop-blur-md"
      >
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                <tr>
                  <th className="px-4 py-4">Description</th>
                  <th className="px-4 py-4">Amount</th>
                  <th className="px-4 py-4">Reference</th>
                  <th className="px-4 py-4">Posted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/50">
                <AnimatePresence mode="popLayout">
                  {transactions.slice(0, 10).map((txn) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={txn.id}
                      onMouseEnter={() => txn.referenceType === 'booking' && txn.referenceId && prefetchBooking(txn.referenceId)}
                      className="transition-colors hover:bg-neutral-50/50"
                    >
                      <td className="px-4 py-4 font-medium text-neutral-900">{txn.description || txn.transactionType}</td>
                      <td className="px-4 py-4 font-bold text-neutral-900">{formatCurrency(txn.amountCents, txn.currency)}</td>
                      <td className="px-4 py-4 text-xs text-neutral-500">
                        {txn.referenceType ? (
                          <span className="rounded-lg bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase">
                            {txn.referenceType} #{txn.referenceId?.slice(0, 8) ?? "—"}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4 text-xs text-neutral-400">
                        {txn.postedAt ? new Date(txn.postedAt).toLocaleDateString() : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div id="withdrawals" className="scroll-mt-6">
        <Card title="Withdrawals">
        {withdrawals.length === 0 ? (
          <p className="text-sm text-slate-500">No withdrawals requested.</p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(entry.amountCents, earnings?.currency ?? wallet?.currency)}
                  </p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {entry.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Disbursed: {entry.disbursedAt ? new Date(entry.disbursedAt).toLocaleString() : "Pending"}
                </p>
              </div>
            ))}
          </div>
        )}
        </Card>
      </div>

      <ConfirmDialog
        open={withdrawDialogOpen}
        title="Request withdrawal"
        description={`Available: ${formatCurrency(availableToWithdrawCents, earnings?.currency ?? wallet?.currency)}. Leave the number blank to use your registered M-Pesa number.`}
        confirmLabel="Submit"
        onConfirm={handleWithdraw}
        onClose={() => setWithdrawDialogOpen(false)}
        loading={withdrawMutation.isLoading}
      >
        <Input
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          value={withdrawAmount}
          onChange={(event) => setWithdrawAmount(event.target.value)}
        />
        <div className="mt-4 space-y-3">
          <Input
            label="Different M-Pesa number (optional)"
            type="tel"
            placeholder="07xx xxx xxx"
            value={payoutPhoneNumber}
            onChange={(event) => {
              setPayoutPhoneNumber(event.target.value);
              setDestinationVerified(false);
              setDestinationCode("");
              setDestinationMasked(null);
            }}
          />
          {payoutPhoneNumber.trim() && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={handleRequestDestinationCode} loading={destinationRequestMutation.isLoading}>
                Send verification code
              </Button>
              {destinationMasked && <p className="text-xs text-slate-500">Code sent to {destinationMasked}.</p>}
              {!destinationVerified && destinationMasked && (
                <div className="flex items-end gap-2">
                  <Input
                    label="Verification code"
                    inputMode="numeric"
                    value={destinationCode}
                    onChange={(event) => setDestinationCode(event.target.value)}
                  />
                  <Button type="button" size="sm" onClick={handleVerifyDestination} loading={destinationVerificationMutation.isLoading}>
                    Verify
                  </Button>
                </div>
              )}
              {destinationVerified && <p className="text-xs font-semibold text-emerald-700">Payout number verified.</p>}
            </>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default ProviderPayments;
