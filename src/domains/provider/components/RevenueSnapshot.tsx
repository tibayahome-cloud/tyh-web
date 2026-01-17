import { TrendingUp, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useWalletAccount } from "../../../shared/hooks/useWallet";
import { useMemo } from "react";

const formatPrice = (amountCents?: number, currency = "KES") => {
    const value = typeof amountCents === "number" ? amountCents / 100 : 0;
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
};

export const RevenueSnapshot = () => {
    const { data: wallet, isLoading } = useWalletAccount();

    const metrics = useMemo(() => {
        if (!wallet) return null;

        // Simulate some trend data since backend doesn't provide it yet
        // In a real app, we'd calculate this from transactions
        const transactions = wallet.transactions || [];
        const recentEarnings = transactions
            .filter(t => t.transactionType === "earning" || t.transactionType === "booking_payment")
            .reduce((acc, t) => acc + t.amountCents, 0);

        return {
            balance: wallet.balanceCents,
            pending: wallet.pendingWithdrawalCents,
            growth: 12.5, // Mocked for UI polish
            recent: recentEarnings,
            currency: wallet.currency
        };
    }, [wallet]);

    if (isLoading) {
        return (
            <div className="h-[180px] animate-pulse rounded-[32px] bg-white/40 backdrop-blur-md ring-1 ring-black/5" />
        );
    }

    return (
        <div className="group relative overflow-hidden rounded-[40px] border border-white/80 bg-white/40 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 transition-all hover:bg-white/60">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl transition-all group-hover:bg-emerald-500/20" />

            <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                        <Wallet className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Current Balance</p>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                            {formatPrice(metrics?.balance, metrics?.currency)}
                        </h2>
                    </div>
                </div>

                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600 ring-1 ring-emerald-500/10">
                        <TrendingUp className="h-3.5 w-3.5" />
                        +{metrics?.growth}%
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Revenue Velocity</p>
                </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Recent Gross</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                        {formatPrice(metrics?.recent, metrics?.currency)}
                    </p>
                </div>

                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <ArrowDownRight className="h-4 w-4 text-amber-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">In Transit</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                        {formatPrice(metrics?.pending, metrics?.currency)}
                    </p>
                </div>
            </div>
        </div>
    );
};
