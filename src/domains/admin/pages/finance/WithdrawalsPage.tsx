import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";
import { fetchAdminWithdrawals } from "../../../../shared/libs/wallet";
import type { WalletWithdrawal } from "../../../../shared/schemas/wallet";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Requested", value: "requested" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Disbursing", value: "disbursing" },
  { label: "Disbursed", value: "disbursed" },
  { label: "Failed", value: "failed" }
];

const PAGE_SIZE = 25;

const formatCurrency = (valueCents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format((valueCents ?? 0) / 100);

const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const statusTone = (status: string) => {
  switch (status) {
    case "disbursed":
      return "bg-emerald-100 text-emerald-700";
    case "requested":
    case "approved":
    case "disbursing":
      return "bg-amber-100 text-amber-700";
    case "rejected":
    case "failed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-200 text-slate-600";
  }
};

const WithdrawalsPage = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftProvider, setDraftProvider] = useState(providerFilter);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WalletWithdrawal | null>(null);
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

  const withdrawalsQuery = useQuery({
    queryKey: ["admin", "finance", "withdrawals", { page, statusFilter, providerFilter }],
    queryFn: () =>
      fetchAdminWithdrawals({
        page,
        size: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter
      }),
    keepPreviousData: true
  });

  const rows = withdrawalsQuery.data?.withdrawals ?? [];
  const meta = withdrawalsQuery.data?.meta ?? {
    total: rows.length,
    page,
    size: PAGE_SIZE,
    totalPages: 1
  };
  const isLastPage = meta.page >= meta.totalPages;
  const showingFrom = rows.length ? (meta.page - 1) * meta.size + 1 : 0;
  const showingTo = rows.length ? showingFrom + rows.length - 1 : 0;

  const openFilters = () => {
    setDraftStatus(statusFilter);
    setDraftProvider(providerFilter);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setProviderFilter(draftProvider.trim());
    setFiltersOpen(false);
    setPage(1);
  };

  const clearFilters = () => {
    setDraftStatus("all");
    setDraftProvider("");
    setStatusFilter("all");
    setProviderFilter("");
    setFiltersOpen(false);
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== "all" || Boolean(providerFilter);

  const filterSummary = useMemo(() => {
    const chips: string[] = [];
    if (statusFilter !== "all") {
      const label = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label;
      if (label) {
        chips.push(`Status: ${label}`);
      }
    }
    if (providerFilter) {
      chips.push(`Provider: ${providerFilter}`);
    }
    if (!chips.length) {
      chips.push("Showing all withdrawals");
    }
    return chips;
  }, [providerFilter, statusFilter]);

  const filteredRows = useMemo(() => {
    if (!providerFilter) {
      return rows;
    }
    const query = providerFilter.trim().toLowerCase();
    return rows.filter((row) => (row.requestedByUserId ?? "").toLowerCase().includes(query));
  }, [rows, providerFilter]);

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
        label="Provider ID"
        placeholder="user_123"
        value={draftProvider}
        onChange={(event) => setDraftProvider(event.target.value)}
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
          <h1 className="text-xl font-semibold text-slate-900">Withdrawals</h1>
          <p className="text-sm text-slate-500">Review provider payout requests and track disbursement progress.</p>
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
                      className="text-sm font-medium text-slate-500"
                      onClick={() => setFiltersOpen(false)}
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
        {withdrawalsQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loading />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No withdrawals found for the selected filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold	text-slate-600">Request</th>
                    <th className="px-4 py-3 text-left font-semibold	text-slate-600">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold	text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold	text-slate-600">Updated</th>
                    <th className="px-4 py-3 text-left font-semibold	text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRows.map((withdrawal) => (
                    <tr key={withdrawal.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{withdrawal.id}</p>
                        <p className="text-xs text-slate-500">
                          Provider {withdrawal.requestedByUserId ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {formatCurrency(withdrawal.amountCents, withdrawal.currency)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusTone(withdrawal.status)}`}>
                          {withdrawal.status.replace(/_/g, " ")}
                        </span>
                        {withdrawal.reason && (
                          <p className="mt-1 text-xs text-slate-500">Reason: {withdrawal.reason}</p>
                        )}
                        {withdrawal.rejectionReason && (
                          <p className="mt-1 text-xs text-rose-600">Rejected: {withdrawal.rejectionReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">{formatDateTime(withdrawal.processedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setSelectedWithdrawal(withdrawal)}>
                            Review
                          </Button>
                          {withdrawal.requestedByUserId && (
                            <Link
                              to={`/admin/providers/${withdrawal.requestedByUserId}`}
                              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Provider
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <span>
                Showing {showingFrom || 0}-{showingTo || 0} of {meta.total}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled={page <= 1 || withdrawalsQuery.isFetching} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={isLastPage || withdrawalsQuery.isFetching} onClick={() => setPage((prev) => prev + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={Boolean(selectedWithdrawal)}
        onClose={() => setSelectedWithdrawal(null)}
        title="Withdrawal detail"
      >
        {!selectedWithdrawal ? (
          <p className="text-sm text-slate-500">Select a withdrawal to inspect full details.</p>
        ) : (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Request ID" value={selectedWithdrawal.id} />
              <DetailField label="Provider ID" value={selectedWithdrawal.requestedByUserId ?? "—"} />
              <DetailField label="Status" value={selectedWithdrawal.status} tone={statusTone(selectedWithdrawal.status)} />
              <DetailField
                label="Amount"
                value={formatCurrency(selectedWithdrawal.amountCents, selectedWithdrawal.currency)}
              />
              <DetailField label="Processed at" value={formatDateTime(selectedWithdrawal.processedAt)} />
              <DetailField label="Reviewed by" value={selectedWithdrawal.reviewedByUserId ?? "—"} />
            </div>
            {selectedWithdrawal.reason && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Submitted reason: {selectedWithdrawal.reason}
              </div>
            )}
            {selectedWithdrawal.rejectionReason && (
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                Rejection note: {selectedWithdrawal.rejectionReason}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedWithdrawal(null)}>
                Close
              </Button>
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

export default WithdrawalsPage;
