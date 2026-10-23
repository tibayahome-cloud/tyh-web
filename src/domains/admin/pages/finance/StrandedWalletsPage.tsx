import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
  fetchStrandedWallets,
  parseTypedShillings,
  settleStrandedWallet,
  type StrandedWallet
} from "../../../../shared/libs/strandedWallets";
import { classifyApiError, getApiError } from "../../../../shared/utils/errors";

const money = (cents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

const listKey = ["admin", "stranded-wallets"] as const;

// Money left in the wallet of an account that was deleted. The account can no longer ask for it, so a super
// admin pays it out to a number they choose. The page makes the amount deliberate: the person retypes it.
const SettleDialog = ({ wallet, onClose }: { wallet: StrandedWallet; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [typedAmount, setTypedAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const typedCents = parseTypedShillings(typedAmount);
  const amountMatches = typedCents === wallet.availableCents;
  const ready = amountMatches && phone.trim().length >= 9 && reason.trim().length >= 5;

  const settle = useMutation({
    mutationFn: () =>
      settleStrandedWallet({
        userId: wallet.userId,
        amountCents: wallet.availableCents,
        phoneNumber: phone.trim(),
        reason: reason.trim()
      }),
    onSuccess: () => {
      toast.showToast({
        title: "Payout started",
        description: `${money(wallet.availableCents, wallet.currency)} is being sent by M-Pesa.`,
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: listKey }).catch(() => undefined);
      onClose();
    },
    onError: (err) => {
      setError(getApiError(err, "We could not start the payout. Nothing was paid."));
      // A refused settlement is usually a changed balance or a withdrawal still running; show the fresh state.
      queryClient.invalidateQueries({ queryKey: listKey }).catch(() => undefined);
    }
  });

  return (
    <Modal
      open
      onClose={settle.isPending ? () => undefined : onClose}
      title="Pay out this wallet"
      description="The account is deleted, so this money cannot be withdrawn by its owner."
      maxWidth="sm"
    >
      <form
        className="space-y-4 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || settle.isPending) return;
          setError(null);
          settle.mutate();
        }}
      >
        <dl className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">Account</dt>
            <dd className="font-medium text-slate-900">{wallet.fullName ?? "Deleted account"}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <dt className="text-slate-600">Amount to pay (whole balance)</dt>
            <dd className="font-semibold text-slate-900">{money(wallet.availableCents, wallet.currency)}</dd>
          </div>
        </dl>

        <Input
          label="M-Pesa number to pay"
          name="settle-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0712345678"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          hint="Check it twice. The money cannot be recalled once sent."
        />

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Why is this being paid out?</span>
          <textarea
            name="settle-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
          />
        </label>

        <Input
          label={`Type the amount to confirm (${wallet.currency})`}
          name="settle-amount"
          inputMode="decimal"
          autoComplete="off"
          value={typedAmount}
          onChange={(event) => setTypedAmount(event.target.value)}
          error={typedAmount && !amountMatches ? "That is not the amount shown above." : undefined}
        />

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={settle.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready} loading={settle.isPending}>
            Pay {money(wallet.availableCents, wallet.currency)}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const StrandedWalletsPage = () => {
  const query = useQuery({ queryKey: listKey, queryFn: fetchStrandedWallets });
  const [selected, setSelected] = useState<StrandedWallet | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/finance/overview" className="text-sm font-medium text-tiba-blue hover:underline">
          Finance overview
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Wallets of deleted accounts</h1>
        <p className="text-sm text-slate-600">
          Money left behind when an account was deleted. Pay it out to a number you choose; the payout then goes
          through the normal M-Pesa path.
        </p>
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ApiErrorBanner
          {...classifyApiError(query.error, "We could not load these wallets.")}
          onRetry={() => void query.refetch()}
        />
      ) : (query.data ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-slate-700">No deleted account is holding money.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(query.data ?? []).map((wallet) => (
            <li key={wallet.userId}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{wallet.fullName ?? "Deleted account"}</p>
                    <p className="text-sm text-slate-600">Deleted {when(wallet.deletedAt)}</p>
                    {wallet.reservedCents > 0 && (
                      <p className="text-sm text-slate-600">{money(wallet.reservedCents, wallet.currency)} is reserved for a withdrawal</p>
                    )}
                    {wallet.blocker && <p className="mt-1 text-sm font-medium text-amber-800">{wallet.blocker}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-600">Available</p>
                      <p className="text-lg font-bold text-slate-900">{money(wallet.availableCents, wallet.currency)}</p>
                    </div>
                    <Button type="button" disabled={!wallet.canSettle} onClick={() => setSelected(wallet)}>
                      Pay out
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {selected && <SettleDialog wallet={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default StrandedWalletsPage;
