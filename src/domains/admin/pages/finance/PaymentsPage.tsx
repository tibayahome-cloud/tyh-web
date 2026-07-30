import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import type { GridColDef } from "@mui/x-data-grid";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { DataGrid } from "../../../../shared/components/DataGrid";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";
import { useRbac } from "../../../../shared/hooks/useRbac";
import { api } from "../../../../shared/libs/api";
import { fetchAdminPayments, fetchFacilityPayments } from "../../../../shared/libs/payments";
import type { PaymentRecord, PaymentSettlement } from "../../../../shared/schemas/payment";
import type { PaymentListResult } from "../../../../shared/libs/payments";
import { canUseGlobalPaymentLedger, FinanceScopeNotice, useAdminFacilityScope } from "./paymentAccess";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentRow = {
  id: string;
  rowNumber: number;
  bookingId: string;
  amountFormatted: string;
  amountCents: number;
  settlement: PaymentSettlement | null;
  status: string;
  method: string;
  providerRef: string;
  retryCount: number;
  initiatedAt: string;
  settledAt: string;
  /** Keep the raw record for the detail modal */
  _raw: PaymentRecord;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending",      value: "pending" },
  { label: "Succeeded",    value: "succeeded" },
  { label: "Failed",       value: "failed" },
  { label: "Refunded",     value: "refunded" },
  { label: "Cancelled",    value: "cancelled" },
];

const METHOD_OPTIONS = [
  { label: "All methods", value: "all" },
  { label: "M-Pesa",      value: "mpesa" },
  { label: "Card",        value: "card" },
  { label: "Cash",        value: "cash" },
];

const PAGE_SIZE = 25;

// ─── Formatters ───────────────────────────────────────────────────────────────

const kesFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat();

const formatKES = (cents: number) => kesFormatter.format((cents ?? 0) / 100);

const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

// ─── Status styling ───────────────────────────────────────────────────────────

const statusTone = (status: string) => {
  switch (status) {
    case "succeeded": return "bg-emerald-100 text-emerald-700";
    case "pending":   return "bg-amber-100 text-amber-700";
    case "failed":    return "bg-rose-100 text-rose-700";
    case "refunded":  return "bg-indigo-100 text-indigo-700";
    default:          return "bg-slate-200 text-slate-600";
  }
};

const SettlementCell = ({ settlement }: { settlement: PaymentSettlement | null }) => {
  if (!settlement) {
    return <span className="text-xs font-medium text-slate-400">Not returned</span>;
  }
  return (
    <div className="space-y-0.5 py-1 text-xs leading-5 text-slate-600">
      <p>
        <span className="font-semibold text-slate-900">TYH:</span> {formatKES(settlement.platformFeeCents)}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Facility:</span> {formatKES(settlement.facilityShareCents)}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Provider:</span> {formatKES(settlement.providerPayoutCents)}
      </p>
    </div>
  );
};

// ─── API call ─────────────────────────────────────────────────────────────────

const fetchPayments = async (params: {
  facilityId?: string;
  pageParam?: string | number;
  status?: string;
  method?: string;
  bookingId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<PaymentListResult> => {
  if (params.facilityId) {
    return fetchFacilityPayments(params.facilityId, {
      page: typeof params.pageParam === "number" ? params.pageParam : 1,
      pageSize: PAGE_SIZE,
      status: params.status
    });
  }
  return fetchAdminPayments({
    cursor: typeof params.pageParam === "string" ? params.pageParam : undefined,
    pageSize: PAGE_SIZE,
    status: params.status,
    method: params.method,
    bookingId: params.bookingId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo
  });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  const border =
    accent === "emerald" ? "border-l-4 border-l-emerald-400"
    : accent === "amber" ? "border-l-4 border-l-amber-400"
    : accent === "rose"  ? "border-l-4 border-l-rose-400"
    : accent === "indigo"? "border-l-4 border-l-indigo-400"
    : "";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{primary}</p>
      {secondary && <p className="mt-0.5 text-xs text-slate-500">{secondary}</p>}
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
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    {tone ? (
      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
        {value || "—"}
      </span>
    ) : (
      <p className={`mt-1 break-all text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </p>
    )}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const PaymentsPage = () => {
  const toast = useToast();
  const { roles } = useRbac();
  const canReadGlobalLedger = canUseGlobalPaymentLedger(roles);
  const facilityScopeQuery = useAdminFacilityScope(!canReadGlobalLedger);
  const facilityId = facilityScopeQuery.facility?.id;

  // ── Committed filter state ────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [bookingFilter, setBookingFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Draft filter state (inside panel, not yet applied) ───────────────────
  const [draftStatus,   setDraftStatus]   = useState("all");
  const [draftMethod,   setDraftMethod]   = useState("all");
  const [draftBooking,  setDraftBooking]  = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo,   setDraftDateTo]   = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileFilters = useMediaQuery("(max-width: 640px)");

  const [detailPayment, setDetailPayment] = useState<PaymentRecord | null>(null);

  // Close desktop dropdown on click-away / Escape
  useEffect(() => {
    if (!filtersOpen || isMobileFilters) return;
    const onClickAway = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltersOpen(false); };
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen, isMobileFilters]);

  // ── Infinite query ────────────────────────────────────────────────────────
  const paymentsQuery = useInfiniteQuery({
    queryKey: ["admin", "finance", "payments", { facilityId, statusFilter, methodFilter, bookingFilter, dateFrom, dateTo }],
    queryFn: ({ pageParam }) =>
      fetchPayments({
        facilityId,
        pageParam,
        status:    statusFilter !== "all" ? statusFilter : undefined,
        method:    canReadGlobalLedger && methodFilter !== "all" ? methodFilter : undefined,
        bookingId: canReadGlobalLedger ? bookingFilter.trim() || undefined : undefined,
        dateFrom:  canReadGlobalLedger ? dateFrom || undefined : undefined,
        dateTo:    canReadGlobalLedger ? dateTo || undefined : undefined,
    }),
    initialPageParam: canReadGlobalLedger ? undefined : 1,
    getNextPageParam: (lastPage) => {
      if (facilityId) {
        return lastPage.meta.page.number < lastPage.meta.page.totalPages
          ? lastPage.meta.page.number + 1
          : undefined;
      }
      return lastPage.meta.next_cursor ?? undefined;
    },
    enabled: canReadGlobalLedger || Boolean(facilityId)
  });

  // ── Retry mutation ────────────────────────────────────────────────────────
  const retryMutation = useMutation({
    mutationFn: (paymentId: string) =>
      api.post(`/admin/payments/payments/${paymentId}/retry`),
    onSuccess: () => {
      toast.showToast({ title: "Retry queued", description: "We'll attempt the payment again shortly.", variant: "success" });
      paymentsQuery.refetch();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Retry failed",
        description: error instanceof Error ? error.message : "Unable to retry payment",
        variant: "error",
      });
    },
  });

  // ── Flatten pages → raw payments ─────────────────────────────────────────
  const allPayments = useMemo<PaymentRecord[]>(
    () => paymentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [paymentsQuery.data]
  );

  // ── Map to grid rows ──────────────────────────────────────────────────────
  const rows = useMemo<PaymentRow[]>(
    () =>
      allPayments.map((p, i) => ({
        id:              p.id,
        rowNumber:       i + 1,
        bookingId:       p.bookingId,
        amountCents:     p.amountCents,
        amountFormatted: formatKES(p.amountCents),
        settlement:      p.settlement,
        status:          p.status,
        method:          p.channel ?? "mpesa",
        providerRef:     p.providerRef ?? p.mpesaReceiptNumber ?? "—",
        retryCount:      p.retryCount,
        initiatedAt:     formatDateTime(p.initiatedAt ?? p.createdAt),
        settledAt:       formatDateTime(p.completedAt ?? p.failedAt ?? p.updatedAt),
        _raw:            p,
      })),
    [allPayments]
  );

  // ── Analytics (client-side, from loaded pages) ────────────────────────────
  const analytics = useMemo(() => {
    const succeeded = allPayments.filter((p) => p.status === "succeeded");
    const pending   = allPayments.filter((p) => p.status === "pending");
    const failed    = allPayments.filter((p) => p.status === "failed");
    const refunded  = allPayments.filter((p) => p.status === "refunded");

    const sum = (arr: PaymentRecord[]) =>
      arr.reduce((s, p) => s + p.amountCents, 0);

    const failureRate =
      allPayments.length > 0
        ? ((failed.length / allPayments.length) * 100).toFixed(1)
        : "0.0";

    const avgRetries =
      failed.length > 0
        ? (failed.reduce((s, p) => s + p.retryCount, 0) / failed.length).toFixed(1)
        : "0";

    return {
      total:          allPayments.length,
      succeededVol:   sum(succeeded),
      succeededCount: succeeded.length,
      pendingVol:     sum(pending),
      pendingCount:   pending.length,
      failedCount:    failed.length,
      refundedVol:    sum(refunded),
      refundedCount:  refunded.length,
      failureRate,
      avgRetries,
    };
  }, [allPayments]);

  // ── DataGrid columns ──────────────────────────────────────────────────────
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
        field: "settlement",
        headerName: "B2B settlement",
        minWidth: 220,
        sortable: false,
        renderCell: ({ value }) => <SettlementCell settlement={value as PaymentSettlement | null} />,
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 130,
        renderCell: ({ value }) => (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(value as string)}`}>
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
        renderCell: ({ value }) =>
          value === "—" ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className="font-mono text-xs text-slate-700">{value}</span>
          ),
      },
      {
        field: "retryCount",
        headerName: "Retries",
        width: 80,
        renderCell: ({ value }) => (
          <span className={(value as number) > 0 ? "font-semibold text-amber-600" : "text-slate-400"}>
            {value}
          </span>
        ),
      },
      { field: "initiatedAt", headerName: "Initiated",        minWidth: 160 },
      { field: "settledAt",   headerName: "Settled / Failed", minWidth: 160 },
      {
        field: "actions",
        headerName: "",
        sortable: false,
        filterable: false,
        width: 140,
        align: "center",
        renderCell: (params) => {
          const row = params.row as PaymentRow;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => setDetailPayment(row._raw)}
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

  // ── Filter panel helpers ──────────────────────────────────────────────────
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
    setDraftStatus("all");   setStatusFilter("all");
    setDraftMethod("all");   setMethodFilter("all");
    setDraftBooking("");     setBookingFilter("");
    setDraftDateFrom("");    setDateFrom("");
    setDraftDateTo("");      setDateTo("");
    setFiltersOpen(false);
  };

  const hasActiveFilters = canReadGlobalLedger
    ? statusFilter !== "all" || methodFilter !== "all" || Boolean(bookingFilter) || Boolean(dateFrom) || Boolean(dateTo)
    : statusFilter !== "all";

  const filterSummaryChips = useMemo(() => {
    const chips: string[] = [];
    if (statusFilter !== "all") chips.push(`Status: ${STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}`);
    if (canReadGlobalLedger) {
      if (methodFilter !== "all") chips.push(`Method: ${METHOD_OPTIONS.find((o) => o.value === methodFilter)?.label}`);
      if (bookingFilter) chips.push(`Booking: ${bookingFilter}`);
      if (dateFrom)      chips.push(`From: ${dateFrom}`);
      if (dateTo)        chips.push(`To: ${dateTo}`);
    }
    return chips;
  }, [canReadGlobalLedger, statusFilter, methodFilter, bookingFilter, dateFrom, dateTo]);

  const filterPanel = (
    <div className="space-y-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>

      {canReadGlobalLedger && (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Payment method</span>
            <select
              value={draftMethod}
              onChange={(e) => setDraftMethod(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        </>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={clearFilters}>Clear</Button>
        <Button type="button" onClick={applyFilters}>Apply</Button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (!canReadGlobalLedger) {
    if (facilityScopeQuery.isLoading) {
      return <FinanceScopeNotice title="Payments" description="Resolving your facility scope..." detail="Payment records will appear once the facility scope is available." />;
    }
    if (!facilityId) {
      return <FinanceScopeNotice title="Payments" description="Your facility scope could not be resolved." detail="Payment data is hidden until the account is linked to exactly one facility." />;
    }
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">
          Inspect facility transactions and review backend-calculated B2B settlement splits.
        </p>
      </div>

      {/* ── Analytics cards ─────────────────────────────────────────────── */}
      {paymentsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total volume (succeeded)"
            primary={formatKES(analytics.succeededVol)}
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

      {/* ── Filters row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">

        {/* Left — record count + active chips */}
        <div className="flex flex-col gap-2">
          {!paymentsQuery.isLoading && (
            <p className="text-sm text-slate-500">
              {numberFormatter.format(analytics.total)} payments loaded
              {paymentsQuery.hasNextPage && " (more available)"}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {filterSummaryChips.length > 0
              ? filterSummaryChips.map((chip) => (
                  <span key={chip} className="rounded-full bg-slate-200 px-3 py-1">{chip}</span>
                ))
              : <span className="text-slate-400">Showing all payments</span>
            }
          </div>
        </div>

        {/* Right — filter button */}
        <div ref={filterMenuRef} className="relative">
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

          {filtersOpen && (
            isMobileFilters ? (
              <>
                <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setFiltersOpen(false)} />
                <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-base font-semibold text-slate-900">Filters</p>
                    <button type="button" onClick={() => setFiltersOpen(false)} className="text-sm font-medium text-slate-500">
                      Close
                    </button>
                  </div>
                  {filterPanel}
                </div>
              </>
            ) : (
              <div className="absolute right-0 z-[60] mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                {filterPanel}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Data table ──────────────────────────────────────────────────── */}
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
                  All payments loaded — {numberFormatter.format(rows.length)} total
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(detailPayment)}
        onClose={() => { if (!retryMutation.isPending) setDetailPayment(null); }}
        title="Payment detail"
      >
        {!detailPayment ? null : (
          <div className="space-y-5">

            {/* Status / amount banner */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusTone(detailPayment.status)}`}>
                {detailPayment.status.replace(/_/g, " ")}
              </span>
              <span className="text-lg font-semibold text-slate-900">
                {formatKES(detailPayment.amountCents)}
              </span>
              {detailPayment.retryCount > 0 && (
                <span className="ml-auto text-xs text-amber-600">
                  {detailPayment.retryCount} retr{detailPayment.retryCount === 1 ? "y" : "ies"}
                </span>
              )}
            </div>

            {/* Fields grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Payment ID"       value={detailPayment.id}               mono />
              <DetailField label="Booking ID"       value={detailPayment.bookingId}       mono />
              <DetailField label="Client user ID"   value={detailPayment.clientUserId}   mono />
              <DetailField label="Provider user ID" value={detailPayment.providerUserId} mono />
              <DetailField label="Method"           value={detailPayment.channel ?? "mpesa"} />
              <DetailField label="Provider ref"     value={detailPayment.providerRef ?? detailPayment.mpesaReceiptNumber}     mono />
              <DetailField label="Initiated"        value={formatDateTime(detailPayment.initiatedAt ?? detailPayment.createdAt)} />
              <DetailField label="Succeeded"        value={formatDateTime(detailPayment.succeededAt ?? detailPayment.completedAt)} />
              {detailPayment.failedAt && (
                <DetailField label="Failed at" value={formatDateTime(detailPayment.failedAt)} />
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">B2B settlement</p>
                  <p className="text-sm text-slate-500">Displayed only when backend settlement metadata is available.</p>
                </div>
                {detailPayment.settlement?.providerCompensationMode && (
                  <span className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:mt-0">
                    {detailPayment.settlement.providerCompensationMode.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              {detailPayment.settlement ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <DetailField label="Booking amount" value={formatKES(detailPayment.settlement.bookingAmountCents)} />
                  <DetailField label="TYH platform fee" value={formatKES(detailPayment.settlement.platformFeeCents)} />
                  <DetailField label="Facility share" value={formatKES(detailPayment.settlement.facilityShareCents)} />
                  <DetailField label="Provider payout" value={formatKES(detailPayment.settlement.providerPayoutCents)} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Settlement metadata was not returned for this payment. Facility wallet and automatic facility payout
                  flows should remain hidden until backend support exists.
                </p>
              )}
            </div>

            {/* Failure reason */}
            {detailPayment.failureReason && (
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                <span className="font-semibold">Failure reason: </span>
                {detailPayment.failureReason}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to={`/admin/bookings/${detailPayment.bookingId}`}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setDetailPayment(null)}
              >
                View booking →
              </Link>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setDetailPayment(null)}>
                  Close
                </Button>
                {canReadGlobalLedger && (detailPayment.status === "failed" || detailPayment.status === "pending") && (
                  <Button
                    loading={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(detailPayment.id)}
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
