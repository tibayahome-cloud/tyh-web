import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { GridColDef } from "@mui/x-data-grid";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { DataGrid } from "../../../../shared/components/DataGrid";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";
import { useCursorInfiniteQuery } from "../../../../shared/hooks/useCursorInfiniteQuery";
import {
  fetchAdminPayment,
  fetchAdminPayments,
  retryPayment,
} from "../../../../shared/libs/payments";
import type { PaymentRecord } from "../../../../shared/schemas/payment";

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Succeeded", value: "succeeded" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
  { label: "Cancelled", value: "cancelled" },
];

const METHOD_OPTIONS = [
  { label: "All methods", value: "all" },
  { label: "M-Pesa", value: "mpesa" },
  { label: "Card", value: "card" },
  { label: "Cash", value: "cash" },
];

const PAGE_SIZE = 25;

// ─── Formatters ─────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (valueCents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    (valueCents ?? 0) / 100
  );

const formatKES = (cents: number) => currencyFormatter.format(cents / 100);

const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const numberFormatter = new Intl.NumberFormat();

// ─── Status helpers ──────────────────────────────────────────────────────────

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
    case "cancelled":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-200 text-slate-600";
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentRow = {
  id: string;
  rowNumber: number;
  bookingId: string;
  amountCents: number;
  amountFormatted: string;
  status: string;
  method: string;
  providerRef: string;
  retryCount: number;
  initiatedAt: string;
  settledAt: string;
  // raw for detail modal
  _raw: PaymentRecord;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const MetricCard = ({
  label,
  primary,
  secondary,
  accent,
}: {
  label: string;
  primary: string;
  secondary?: string;
  accent?: "emerald" | "amber" | "rose" | "indigo";
}) => {
  const accentClass =
    accent === "emerald"
      ? "border-l-4 border-l-emerald-400"
      : accent === "amber"
      ? "border-l-4 border-l-amber-400"
      : accent === "rose"
      ? "border-l-4 border-l-rose-400"
      : accent === "indigo"
      ? "border-l-4 border-l-indigo-400"
      : "";

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${accentClass}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{primary}</p>
      {secondary && (
        <p className="mt-0.5 text-xs text-slate-500">{secondary}</p>
      )}
    </div>
  );
};

const DetailField = ({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  tone?: string;
  mono?: boolean;
}) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    {tone ? (
      <span
        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}
      >
        {value || "—"}
      </span>
    ) : (
      <p
        className={`mt-1 text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value || "—"}
      </p>
    )}
  </div>
);

// ─── Main page ───────────────────────────────────────────────────────────────

const PaymentsPage = () => {
  const toast = useToast();

  // Filters state (committed)
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [bookingFilter, setBookingFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Draft state (inside filter panel)
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftMethod, setDraftMethod] = useState("all");
  const [draftBooking, setDraftBooking] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileFilters = useMediaQuery("(max-width: 640px)");

  const [detailId, setDetailId] = useState<string | null>(null);

  // Close desktop filter on click-away / Escape
  useEffect(() => {
    if (!filtersOpen || isMobileFilters) return;
    const handleClickAway = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setFiltersOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleKey);
    };
  }, [filtersOpen, isMobileFilters]);

  // ── Payments list (cursor-based infinite) ──────────────────────────────────
  const paymentsQuery = useCursorInfiniteQuery({
    queryKey: [
      "admin",
      "finance",
      "payments",
      { statusFilter, methodFilter, bookingFilter, dateFrom, dateTo },
    ],
    queryFn: ({ pageParam }) =>
      fetchAdminPayments({
        cursor: pageParam,
        limit: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        method: methodFilter === "all" ? undefined : methodFilter,
        bookingId: bookingFilter.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  // ── Payment detail ─────────────────────────────────────────────────────────
  const detailQuery = useQuery({
    queryKey: ["admin", "finance", "payments", "detail", detailId],
    queryFn: () => {
      if (!detailId) throw new Error("Missing payment id");
      return fetchAdminPayment(detailId);
    },
    enabled: Boolean(detailId),
  });

  // ── Retry mutation ─────────────────────────────────────────────────────────
  const retryMutation = useMutation({
    mutationFn: (paymentId: string) => retryPayment(paymentId),
    onSuccess: () => {
      toast.showToast({
        title: "Retry queued",
        description: "We'll attempt the payment again shortly.",
        variant: "success",
      });
      paymentsQuery.refetch();
      detailQuery.refetch();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Retry failed",
        description:
          error instanceof Error ? error.message : "Unable to retry payment",
        variant: "error",
      });
    },
  });

  // ── Flatten pages → rows ───────────────────────────────────────────────────
  const allPayments: PaymentRecord[] = useMemo(
    () => paymentsQuery.data?.pages.flatMap((page) => page.payments) ?? [],
    [paymentsQuery.data]
  );

  const rows = useMemo<PaymentRow[]>(
    () =>
      allPayments.map((payment, index) => ({
        id: payment.id,
        rowNumber: index + 1,
        bookingId: payment.bookingId ?? payment.booking_id ?? "—",
        amountCents: payment.amountCents ?? payment.amount_cents ?? 0,
        amountFormatted: formatCurrency(
          payment.amountCents ?? payment.amount_cents ?? 0,
          payment.currency ?? "KES"
        ),
        status: payment.status,
        method: payment.channel ?? payment.method ?? "mpesa",
        providerRef: payment.providerRef ?? payment.provider_ref ?? "—",
        retryCount: payment.retryCount ?? payment.retry_count ?? 0,
        initiatedAt: formatDateTime(
          payment.initiatedAt ?? payment.initiated_at
        ),
        settledAt: formatDateTime(
          payment.succeededAt ??
            payment.succeeded_at ??
            payment.completedAt ??
            payment.updatedAt
        ),
        _raw: payment,
      })),
    [allPayments]
  );

  // ── Analytics derived from loaded data ────────────────────────────────────
  const analytics = useMemo(() => {
    const succeeded = allPayments.filter((p) => p.status === "succeeded");
    const pending = allPayments.filter((p) => p.status === "pending");
    const failed = allPayments.filter((p) => p.status === "failed");
    const refunded = allPayments.filter((p) => p.status === "refunded");

    const totalVol = succeeded.reduce(
      (sum, p) => sum + (p.amountCents ?? p.amount_cents ?? 0),
      0
    );
    const pendingVol = pending.reduce(
      (sum, p) => sum + (p.amountCents ?? p.amount_cents ?? 0),
      0
    );
    const refundedVol = refunded.reduce(
      (sum, p) => sum + (p.amountCents ?? p.amount_cents ?? 0),
      0
    );
    const failureRate =
      allPayments.length > 0
        ? ((failed.length / allPayments.length) * 100).toFixed(1)
        : "0.0";
    const avgRetries =
      failed.length > 0
        ? (
            failed.reduce(
              (sum, p) => sum + (p.retryCount ?? p.retry_count ?? 0),
              0
            ) / failed.length
          ).toFixed(1)
        : "0";

    return {
      totalVol,
      pendingVol,
      refundedVol,
      succeededCount: succeeded.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      refundedCount: refunded.length,
      total: allPayments.length,
      failureRate,
      avgRetries,
    };
  }, [allPayments]);

  // ── DataGrid columns ───────────────────────────────────────────────────────
  const columns = useMemo<GridColDef[]>(
    () => [
      { field: "rowNumber", headerName: "#", width: 60, sortable: false },
      {
        field: "bookingId",
        headerName: "Booking ID",
        flex: 1.2,
        minWidth: 180,
        renderCell: ({ value }) => (
          <span className="font-mono text-xs text-slate-700">{value}</span>
        ),
      },
      {
        field: "amountFormatted",
        headerName: "Amount",
        minWidth: 130,
        renderCell: ({ value }) => (
          <span className="font-semibold text-slate-900">{value}</span>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 130,
        renderCell: ({ value }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(value as string)}`}
          >
            {(value as string).replace(/_/g, " ")}
          </span>
        ),
      },
      {
        field: "method",
        headerName: "Method",
        minWidth: 110,
        renderCell: ({ value }) => (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {value}
          </span>
        ),
      },
      {
        field: "providerRef",
        headerName: "Provider Ref",
        minWidth: 150,
        renderCell: ({ value }) => (
          <span className="font-mono text-xs text-slate-600">
            {value === "—" ? (
              <span className="text-slate-400">—</span>
            ) : (
              value
            )}
          </span>
        ),
      },
      {
        field: "retryCount",
        headerName: "Retries",
        width: 80,
        renderCell: ({ value }) => (
          <span
            className={
              (value as number) > 0
                ? "font-semibold text-amber-600"
                : "text-slate-400"
            }
          >
            {value}
          </span>
        ),
      },
      { field: "initiatedAt", headerName: "Initiated", minWidth: 160 },
      { field: "settledAt", headerName: "Settled / Updated", minWidth: 160 },
      {
        field: "actions",
        headerName: "",
        sortable: false,
        filterable: false,
        width: 130,
        align: "center",
        renderCell: (params) => {
          const row = params.row as PaymentRow;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => setDetailId(row.id)}
              >
                View
              </Button>
              <Link
                to={`/admin/bookings/${row.bookingId}`}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Booking
              </Link>
            </div>
          );
        },
      },
    ],
    []
  );

  // ── Filter panel UI ────────────────────────────────────────────────────────
  const openFilters = () => {
    setDraftStatus(statusFilter);
    setDraftMethod(methodFilter);
    setDraftBooking(bookingFilter);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setMethodFilter(draftMethod);
    setBookingFilter(draftBooking.trim());
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftStatus("all");
    setDraftMethod("all");
    setDraftBooking("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setStatusFilter("all");
    setMethodFilter("all");
    setBookingFilter("");
    setDateFrom("");
    setDateTo("");
    setFiltersOpen(false);
  };

  const hasActiveFilters =
    statusFilter !== "all" ||
    methodFilter !== "all" ||
    Boolean(bookingFilter) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const filterSummaryChips = useMemo(() => {
    const chips: string[] = [];
    if (statusFilter !== "all")
      chips.push(
        `Status: ${STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}`
      );
    if (methodFilter !== "all")
      chips.push(
        `Method: ${METHOD_OPTIONS.find((o) => o.value === methodFilter)?.label}`
      );
    if (bookingFilter) chips.push(`Booking: ${bookingFilter}`);
    if (dateFrom) chips.push(`From: ${dateFrom}`);
    if (dateTo) chips.push(`To: ${dateTo}`);
    return chips;
  }, [statusFilter, methodFilter, bookingFilter, dateFrom, dateTo]);

  const filterPanel = (
    <div className="space-y-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Payment method</span>
        <select
          value={draftMethod}
          onChange={(e) => setDraftMethod(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Booking ID"
        placeholder="e.g. 6c5fd013-..."
        value={draftBooking}
        onChange={(e) => setDraftBooking(e.target.value)}
      />
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Date from</span>
        <input
          type="date"
          value={draftDateFrom}
          onChange={(e) => setDraftDateFrom(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Date to</span>
        <input
          type="date"
          value={draftDateTo}
          onChange={(e) => setDraftDateTo(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </label>
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

  const selectedPayment = detailQuery.data;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">
          Inspect transactions, retry failures, and track revenue totals.
        </p>
      </div>

      {/* Analytics / metric cards */}
      {paymentsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total volume (succeeded)"
            primary={formatKES(analytics.totalVol)}
            secondary={`${numberFormatter.format(analytics.succeededCount)} transactions`}
            accent="emerald"
          />
          <MetricCard
            label="Pending"
            primary={formatKES(analytics.pendingVol)}
            secondary={`${numberFormatter.format(analytics.pendingCount)} awaiting settlement`}
            accent="amber"
          />
          <MetricCard
            label="Failed"
            primary={numberFormatter.format(analytics.failedCount)}
            secondary={`Failure rate ${analytics.failureRate}% • avg ${analytics.avgRetries} retries`}
            accent="rose"
          />
          <MetricCard
            label="Refunded"
            primary={formatKES(analytics.refundedVol)}
            secondary={`${numberFormatter.format(analytics.refundedCount)} refunds issued`}
            accent="indigo"
          />
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div ref={filterMenuRef} className="relative inline-flex">
            <Button
              variant={hasActiveFilters ? "primary" : "secondary"}
              onClick={openFilters}
              className="inline-flex items-center gap-2"
            >
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  {filterSummaryChips.length}
                </span>
              )}
            </Button>

            {filtersOpen &&
              (isMobileFilters ? (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-slate-900/40"
                    onClick={() => setFiltersOpen(false)}
                  />
                  <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-base font-semibold text-slate-900">
                        Filters
                      </p>
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

          {/* Active filter chips */}
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {filterSummaryChips.length > 0 ? (
              filterSummaryChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-slate-200 px-3 py-1"
                >
                  {chip}
                </span>
              ))
            ) : (
              <span className="text-slate-400">Showing all payments</span>
            )}
          </div>
        </div>

        {/* Total count badge */}
        {!paymentsQuery.isLoading && (
          <p className="self-center text-sm text-slate-500">
            {numberFormatter.format(analytics.total)} payments loaded
            {paymentsQuery.hasNextPage && " (more available)"}
          </p>
        )}
      </div>

      {/* Data table */}
      <Card padding="none">
        {paymentsQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loading />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No payments match the selected filters.
          </div>
        ) : (
          <>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={paymentsQuery.isFetchingNextPage}
            />

            {/* Load more / end of list footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              {paymentsQuery.hasNextPage ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => paymentsQuery.fetchNextPage()}
                  loading={paymentsQuery.isFetchingNextPage}
                >
                  Load more payments
                </Button>
              ) : (
                <p className="text-center text-xs text-slate-400">
                  All payments loaded — {numberFormatter.format(rows.length)}{" "}
                  total
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(detailId)}
        onClose={() => {
          if (!retryMutation.isPending) setDetailId(null);
        }}
        title="Payment detail"
      >
        {detailQuery.isLoading ? (
          <Loading />
        ) : !selectedPayment ? (
          <p className="text-sm text-slate-500">Payment not found.</p>
        ) : (
          <div className="space-y-5">
            {/* Status banner */}
            <div
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${statusTone(selectedPayment.status)} bg-opacity-20`}
            >
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusTone(selectedPayment.status)}`}
              >
                {selectedPayment.status.replace(/_/g, " ")}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrency(
                  selectedPayment.amountCents ?? selectedPayment.amount_cents ?? 0,
                  selectedPayment.currency ?? "KES"
                )}
              </span>
              {(selectedPayment.retryCount ?? selectedPayment.retry_count ?? 0) >
                0 && (
                <span className="ml-auto text-xs text-amber-600">
                  {selectedPayment.retryCount ?? selectedPayment.retry_count}{" "}
                  retry
                  {(selectedPayment.retryCount ?? selectedPayment.retry_count ?? 0) >
                  1
                    ? "ies"
                    : ""}
                </span>
              )}
            </div>

            {/* Core fields grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField
                label="Payment ID"
                value={selectedPayment.id}
                mono
              />
              <DetailField
                label="Booking ID"
                value={
                  selectedPayment.bookingId ?? selectedPayment.booking_id
                }
                mono
              />
              <DetailField
                label="Client user ID"
                value={
                  selectedPayment.clientUserId ?? selectedPayment.client_user_id
                }
                mono
              />
              <DetailField
                label="Provider user ID"
                value={
                  selectedPayment.providerUserId ??
                  selectedPayment.provider_user_id
                }
                mono
              />
              <DetailField
                label="Method / channel"
                value={selectedPayment.channel ?? selectedPayment.method}
              />
              <DetailField
                label="Provider ref"
                value={
                  selectedPayment.providerRef ?? selectedPayment.provider_ref
                }
                mono
              />
              <DetailField
                label="Initiated"
                value={formatDateTime(
                  selectedPayment.initiatedAt ?? selectedPayment.initiated_at
                )}
              />
              <DetailField
                label="Settled"
                value={formatDateTime(
                  selectedPayment.succeededAt ??
                    selectedPayment.succeeded_at ??
                    selectedPayment.completedAt
                )}
              />
              {(selectedPayment.failedAt ?? selectedPayment.failed_at) && (
                <DetailField
                  label="Failed at"
                  value={formatDateTime(
                    selectedPayment.failedAt ?? selectedPayment.failed_at
                  )}
                />
              )}
            </div>

            {/* Failure reason */}
            {(selectedPayment.failureReason ?? selectedPayment.failure_reason) && (
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                <span className="font-semibold">Failure reason: </span>
                {selectedPayment.failureReason ?? selectedPayment.failure_reason}
              </div>
            )}

            {/* Attempts */}
            {selectedPayment.attempts && selectedPayment.attempts.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Gateway attempts ({selectedPayment.attempts.length})
                </p>
                <ul className="space-y-2">
                  {selectedPayment.attempts.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900">
                          {attempt.status}
                        </span>
                        <span>{formatDateTime(attempt.createdAt)}</span>
                      </div>
                      {attempt.responsePayload && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-[11px]">
                          {JSON.stringify(attempt.responsePayload, null, 2)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to={`/admin/bookings/${selectedPayment.bookingId ?? selectedPayment.booking_id}`}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setDetailId(null)}
              >
                View booking →
              </Link>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setDetailId(null)}>
                  Close
                </Button>
                {(selectedPayment.status === "failed" ||
                  selectedPayment.status === "pending") && (
                  <Button
                    loading={retryMutation.isPending}
                    onClick={() =>
                      retryMutation.mutate(selectedPayment.id)
                    }
                  >
                    Retry payment
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentsPage;