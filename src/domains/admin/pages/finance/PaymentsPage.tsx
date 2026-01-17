import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";
import {
  fetchAdminPayment,
  fetchAdminPayments,
  retryPayment
} from "../../../../shared/libs/payments";
import type { PaymentRecord } from "../../../../shared/schemas/payment";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Succeeded", value: "succeeded" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
  { label: "Cancelled", value: "cancelled" }
];

const PAGE_SIZE = 25;

const formatCurrency = (valueCents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format((valueCents ?? 0) / 100);

const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const statusTone = (status: string) => {
  switch (status) {
    case "succeeded":
      return "bg-emerald-100 text-emerald-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "refunded":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-slate-200 text-slate-600";
  }
};

const PaymentsPage = () => {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [bookingFilter, setBookingFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftBooking, setDraftBooking] = useState(bookingFilter);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const isMobileFilters = useMediaQuery("(max-width: 640px)");

  useEffect(() => {
    if (!filtersOpen || isMobileFilters) {
      return;
    }
    const handleClickAway = (event: MouseEvent) => {
      if (!filterMenuRef.current) {
        return;
      }
      if (!filterMenuRef.current.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleKey);
    };
  }, [filtersOpen, isMobileFilters]);

  const paymentsQuery = useQuery({
    queryKey: ["admin", "finance", "payments", { page, statusFilter, bookingFilter }],
    queryFn: () =>
      fetchAdminPayments({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        bookingId: bookingFilter.trim() || undefined
      }),
    keepPreviousData: true
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "finance", "payments", "detail", detailId],
    queryFn: () => {
      if (!detailId) {
        throw new Error("Missing payment id");
      }
      return fetchAdminPayment(detailId);
    },
    enabled: Boolean(detailId)
  });

  const retryMutation = useMutation({
    mutationFn: (paymentId: string) => retryPayment(paymentId),
    onSuccess: () => {
      toast.showToast({
        title: "Retry queued",
        description: "We’ll attempt the payment again shortly.",
        variant: "success"
      });
      paymentsQuery.refetch();
      detailQuery.refetch();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Retry failed",
        description: error instanceof Error ? error.message : "Unable to retry payment",
        variant: "error"
      });
    }
  });

  const rows = paymentsQuery.data?.payments ?? [];
  const pageMeta = paymentsQuery.data?.meta.page ?? {
    number: page,
    size: PAGE_SIZE,
    total: rows.length,
    totalPages: 1
  };
  const isLastPage = pageMeta.number >= pageMeta.totalPages;
  const showingFrom = rows.length ? (pageMeta.number - 1) * pageMeta.size + 1 : 0;
  const showingTo = rows.length ? showingFrom + rows.length - 1 : 0;

  const openFilters = () => {
    setDraftStatus(statusFilter);
    setDraftBooking(bookingFilter);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setBookingFilter(draftBooking.trim());
    setFiltersOpen(false);
    setPage(1);
  };

  const clearFilters = () => {
    setDraftStatus("all");
    setDraftBooking("");
    setStatusFilter("all");
    setBookingFilter("");
    setFiltersOpen(false);
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== "all" || Boolean(bookingFilter);

  const selectedPayment = detailQuery.data;

  const filterSummary = useMemo(() => {
    const chips: string[] = [];
    const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? null;
    if (statusLabel && statusFilter !== "all") {
      chips.push(`Status: ${statusLabel}`);
    }
    if (bookingFilter) {
      chips.push(`Booking: ${bookingFilter}`);
    }
    if (!chips.length) {
      chips.push("Showing all payments");
    }
    return chips;
  }, [statusFilter, bookingFilter]);

  const filterPanel = (
    <div className="space-y-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          value={draftStatus}
          onChange={(event) => setDraftStatus(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Booking ID"
        placeholder="e.g. bkg_123"
        value={draftBooking}
        onChange={(event) => setDraftBooking(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={clearFilters}>
          Clear
        </Button>
        <Button type="button" onClick={applyFilters}>
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500">Inspect every transaction, retry failures, and jump to booking context.</p>
        </div>
        <div ref={filterMenuRef} className="relative">
          <Button variant={hasActiveFilters ? "primary" : "secondary"} onClick={openFilters}>
            Filters
          </Button>
          {filtersOpen &&
            (isMobileFilters ? (
              <>
                <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setFiltersOpen(false)} />
                <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-base font-semibold text-slate-900">Filters</p>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="text-sm font-medium text-slate-500"
                    >
                      Close
                    </button>
                  </div>
                  {filterPanel}
                </div>
              </>
            ) : (
              <div className="absolute left-0 z-[60] mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:left-auto md:right-0">
                {filterPanel}
              </div>
            ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        {filterSummary.map((chip) => (
          <span key={chip} className="rounded-full bg-slate-200 px-3 py-1">
            {chip}
          </span>
        ))}
      </div>

      <Card padding="none">
        {paymentsQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loading />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No payments match the selected filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Booking</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Channel</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Updated</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((payment) => (
                    <tr key={payment.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{payment.booking?.service?.name ?? payment.bookingId}</p>
                        <p className="text-xs text-slate-500">{payment.bookingId}</p>
                        {payment.booking?.client && (
                          <p className="text-xs text-slate-400">
                            Client: {payment.booking.client.fullName ?? payment.booking.client.id}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {formatCurrency(payment.amountCents, payment.currency)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(payment.status)}`}>
                          {payment.status.replace(/_/g, " ")}
                        </span>
                        {payment.failureReason && (
                          <p className="mt-1 text-xs text-rose-600">{payment.failureReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{payment.channel ?? "mpesa"}</td>
                      <td className="px-4 py-4 text-sm text-slate-500">{formatDateTime(payment.completedAt ?? payment.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setDetailId(payment.id)}>
                            View
                          </Button>
                          <Link
                            to={`/admin/bookings/${payment.bookingId}`}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Booking
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <span>
                Showing {showingFrom || 0}-{showingTo || 0} of {pageMeta.total}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled={page <= 1 || paymentsQuery.isFetching} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={isLastPage || paymentsQuery.isFetching} onClick={() => setPage((prev) => prev + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

  <Modal
        open={Boolean(detailId)}
        onClose={() => {
          if (!retryMutation.isPending) {
            setDetailId(null);
          }
        }}
        title="Payment detail"
      >
        {detailQuery.isLoading ? (
          <Loading />
        ) : !selectedPayment ? (
          <p className="text-sm text-slate-500">Payment was not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Payment ID" value={selectedPayment.id} />
              <DetailField label="Booking ID" value={selectedPayment.bookingId} />
              <DetailField label="Status" value={selectedPayment.status} tone={statusTone(selectedPayment.status)} />
              <DetailField label="Channel" value={selectedPayment.channel ?? "mpesa"} />
              <DetailField label="Amount" value={formatCurrency(selectedPayment.amountCents, selectedPayment.currency)} />
              <DetailField label="Updated" value={formatDateTime(selectedPayment.updatedAt)} />
            </div>
            {selectedPayment.failureReason && (
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                Failure reason: {selectedPayment.failureReason}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">Attempts</p>
              {selectedPayment.attempts.length === 0 ? (
                <p className="text-sm text-slate-500">No gateway attempts recorded.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedPayment.attempts.map((attempt) => (
                    <li key={attempt.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900">{attempt.status}</span>
                        <span>{formatDateTime(attempt.createdAt)}</span>
                      </div>
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-[11px]">
                        {JSON.stringify(attempt.responsePayload, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDetailId(null)}>
                Close
              </Button>
              {(selectedPayment.status === "failed" || selectedPayment.status === "pending") && (
                <Button loading={retryMutation.isPending} onClick={() => retryMutation.mutate(selectedPayment.id)}>
                  Retry payment
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const DetailField = ({
  label,
  value,
  tone
}: {
  label: string;
  value: string | null | undefined;
  tone?: string;
}) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    {tone ? (
      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
        {value || "—"}
      </span>
    ) : (
      <p className="mt-1 text-sm text-slate-900">{value || "—"}</p>
    )}
  </div>
);

export default PaymentsPage;
