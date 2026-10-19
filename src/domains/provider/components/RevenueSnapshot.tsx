import { Wallet } from "lucide-react";
import { useMemo } from "react";

import { KpiCard } from "../../../shared/components/KpiCard";
import { WidgetError } from "../../../shared/components/WidgetError";
import { useProviderEarningsSummary } from "../../../shared/hooks/useWallet";

const formatPrice = (amountCents: number, currency = "KES") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountCents / 100);

type RevenueSnapshotProps = {
    financialsVisible?: boolean;
};

export const RevenueSnapshot = ({ financialsVisible = true }: RevenueSnapshotProps) => {
    const { data: earnings, isLoading, isError, refetch } = useProviderEarningsSummary({ enabled: financialsVisible });

    const metrics = useMemo(() => {
        if (!earnings) return null;

        return {
            balance: earnings.availableBalanceCents,
            pending: earnings.pendingEarningsCents,
            paidOut: earnings.paidOutTotalCents,
            currency: earnings.currency
        };
    }, [earnings]);

    if (!financialsVisible) return null;

    if (isLoading) {
        return <div className="h-[180px] animate-pulse rounded-xl bg-slate-100" aria-hidden />;
    }

    // A failed request is not an empty wallet. Showing KES 0.00 here told a provider they had nothing to withdraw.
    if (isError || !metrics) {
        return <WidgetError what="your earnings" onRetry={() => void refetch()} />;
    }

    return (
        <KpiCard
            label="Available to withdraw"
            value={formatPrice(metrics.balance, metrics.currency)}
            caption="In your wallet now"
            icon={<Wallet className="h-5 w-5" />}
            action={{ label: "Withdraw", to: "/pro/payments" }}
        >
            <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <dt className="text-slate-600">Pending earnings</dt>
                    <dd className="font-semibold text-slate-900">{formatPrice(metrics.pending, metrics.currency)}</dd>
                    <dd className="text-xs text-slate-600">Not available yet</dd>
                </div>
                <div>
                    <dt className="text-slate-600">Paid out</dt>
                    <dd className="font-semibold text-slate-900">{formatPrice(metrics.paidOut, metrics.currency)}</dd>
                    <dd className="text-xs text-slate-600">So far</dd>
                </div>
            </dl>
        </KpiCard>
    );
};
