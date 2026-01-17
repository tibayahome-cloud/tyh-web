import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { fetchPaymentSummary, fetchAdminPayments } from "../../../../shared/libs/payments";
import { fetchAdminWithdrawals } from "../../../../shared/libs/wallet";
import type { PaymentRecord } from "../../../../shared/schemas/payment";
import type { WalletWithdrawal } from "../../../../shared/schemas/wallet";

const formatCurrency = (valueCents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format((valueCents ?? 0) / 100);

const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const linkButtonClasses = (variant: "primary" | "secondary" | "ghost" = "primary") => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2";
  if (variant === "secondary") {
    return `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
  }
  if (variant === "ghost") {
    return `${base} text-primary-600 hover:text-primary-700 hover:bg-primary-50`;
  }
  return `${base} bg-primary-500 text-white hover:bg-primary-600`;
};

const statusTone = (status: string) => {
  switch (status) {
    case "succeeded":
    case "disbursed":
      return "bg-emerald-100 text-emerald-700";
    case "pending":
    case "requested":
    case "disbursing":
      return "bg-amber-100 text-amber-700";
    case "failed":
    case "rejected":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-200 text-slate-600";
  }
};

const FinanceOverviewPage = () => {
  const summaryQuery = useQuery({
    queryKey: ["admin", "finance", "summary"],
    queryFn: fetchPaymentSummary,
    staleTime: 60_000
  });

  const recentPaymentsQuery = useQuery({
    queryKey: ["admin", "finance", "payments", "recent"],
    queryFn: () => fetchAdminPayments({ pageSize: 5 }),
    staleTime: 30_000
  });

  const withdrawalQueueQuery = useQuery({
    queryKey: ["admin", "finance", "withdrawals", "recent"],
    queryFn: () => fetchAdminWithdrawals({ size: 5 }),
    staleTime: 30_000
  });

  const summary = summaryQuery.data;

  const statCards = [
    {
      label: "Total collected",
      value: summary ? formatCurrency(summary.totalCollectedCents) : "—",
      helper: "Captured via C2B flows"
    },
    {
      label: "Pending settlement",
      value: summary ? formatCurrency(summary.pendingCents) : "—",
      helper: "Awaiting confirmation or webhook"
    },
    {
      label: "Failed payments (24h)",
      value: summary ? summary.failedCount.toString() : "—",
      helper: "Needs manual intervention"
    }
  ];

  const payments = recentPaymentsQuery.data?.payments ?? [];
  const withdrawals = withdrawalQueueQuery.data?.withdrawals ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Finance overview</h1>
          <p className="text-sm text-slate-500">
            Track cash collections, settlement queues, and pending withdrawals in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/finance/payments" className={linkButtonClasses("primary")}>
            Payments
          </Link>
          <Link to="/admin/finance/withdrawals" className={linkButtonClasses("secondary")}>
            Withdrawals
          </Link>
        </div>
      </div>

      <section>
        {summaryQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`finance-metric-${index}`} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500">{card.helper}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Recent payments"
          subtitle="Latest five transactions across bookings."
          description="Tap into the full ledger from the payments screen."
          padding="none"
        >
          {recentPaymentsQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loading />
            </div>
          ) : payments.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">No payments have been captured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Booking</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {payments.map((payment: PaymentRecord) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{payment.booking?.service?.name ?? payment.bookingId}</p>
                        <p className="text-xs text-slate-500">{payment.bookingId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{formatCurrency(payment.amountCents, payment.currency)}</p>
                        <p className="text-xs text-slate-500">{payment.channel ?? "mpesa"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(payment.status)}`}>
                          {payment.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(payment.completedAt ?? payment.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-end border-t border-slate-200 px-6 py-4">
            <Link to="/admin/finance/payments" className={linkButtonClasses("ghost")}>
              View all payments →
            </Link>
          </div>
        </Card>

        <Card
          title="Withdrawal queue"
          subtitle="Providers awaiting disbursement or review."
          description="Approve or reject from the withdrawals workspace."
          padding="none"
        >
          {withdrawalQueueQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loading />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">No pending withdrawal requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Request</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {withdrawals.map((withdrawal: WalletWithdrawal) => (
                    <tr key={withdrawal.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{withdrawal.id}</p>
                        <p className="text-xs text-slate-500">
                          Provider {withdrawal.requestedByUserId ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatCurrency(withdrawal.amountCents, withdrawal.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(withdrawal.status)}`}>
                          {withdrawal.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(withdrawal.processedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-end border-t border-slate-200 px-6 py-4">
            <Link to="/admin/finance/withdrawals" className={linkButtonClasses("ghost")}>
              Go to withdrawals →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FinanceOverviewPage;
