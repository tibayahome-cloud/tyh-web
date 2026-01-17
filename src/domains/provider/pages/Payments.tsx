import { useState } from "react";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Input } from "../../../shared/components/Input";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import { Loading } from "../../../shared/components/Loading";
import { useToast } from "../../../shared/components/ToastProvider";
import { useWalletAccount, useWalletWithdrawalRequest } from "../../../shared/hooks/useWallet";
import { motion, AnimatePresence } from "framer-motion";
import { prefetchBooking } from "../../../shared/libs/query";

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
  const walletQuery = useWalletAccount();
  const withdrawMutation = useWalletWithdrawalRequest();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const wallet = walletQuery.data;
  const transactions = wallet?.transactions ?? [];
  const withdrawals = wallet?.withdrawals ?? [];

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
    withdrawMutation
      .mutateAsync({ amountCents: Math.round(amount * 100) })
      .then(() => {
        toast.showToast({
          title: "Withdrawal requested",
          description: "We’ll notify you after review.",
          variant: "success"
        });
        setWithdrawAmount("");
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

  if (walletQuery.isLoading && !wallet) {
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Payments & Wallet</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setWithdrawDialogOpen(true)}
            disabled={!wallet || (wallet.balanceCents ?? 0) <= 0 || withdrawMutation.isLoading}
          >
            Request withdrawal
          </Button>
          <Button variant="secondary">Wallet history</Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <motion.article
          whileHover={{ y: -4 }}
          className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-card backdrop-blur-md ring-1 ring-black/[0.03] transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Wallet balance</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {formatCurrency(wallet?.balanceCents, wallet?.currency)}
          </p>
        </motion.article>

        <motion.article
          whileHover={{ y: -4 }}
          className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-card backdrop-blur-md ring-1 ring-black/[0.03] transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Pending withdrawals</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {formatCurrency(wallet?.pendingWithdrawalCents, wallet?.currency)}
          </p>
        </motion.article>

        <motion.article
          whileHover={{ y: -4 }}
          className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-card backdrop-blur-md ring-1 ring-black/[0.03] transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Account status</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900 capitalize">{wallet?.status ?? "—"}</p>
        </motion.article>
      </section>

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

      <Card title="Withdrawals">
        {withdrawals.length === 0 ? (
          <p className="text-sm text-slate-500">No withdrawals requested.</p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{formatCurrency(entry.amountCents, entry.currency)}</p>
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

      <ConfirmDialog
        open={withdrawDialogOpen}
        title="Request withdrawal"
        description={`Balance: ${formatCurrency(wallet?.balanceCents, wallet?.currency)}`}
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
      </ConfirmDialog>
    </div>
  );
};

export default ProviderPayments;
