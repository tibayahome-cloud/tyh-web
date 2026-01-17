import type { GridColDef } from "@mui/x-data-grid";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { DataGrid } from "../../../../shared/components/DataGrid";
import { Loading } from "../../../../shared/components/Loading";
import { Input } from "../../../../shared/components/Input";
import { useNotifications, useNotificationPreferences } from "../../../../shared/hooks/useNotifications";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";

const PAGE_SIZE = 20;

const AdminNotificationsPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { notifications, meta, isLoading, isFetching, markAllAsRead } = useNotifications({
    page,
    pageSize: PAGE_SIZE
  });
  const { preferences, isLoading: prefsLoading } = useNotificationPreferences();

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
  }, [filtersOpen]);
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "delivered">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"all" | "unread" | "delivered">("all");
  const [draftSearch, setDraftSearch] = useState("");
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileFilters = useMediaQuery("(max-width: 640px)");

  const columns = useMemo<GridColDef[]>(
    () => [
      { field: "title", headerName: "Title", flex: 1.4, minWidth: 220 },
      { field: "event", headerName: "Event", flex: 1, minWidth: 180 },
      { field: "status", headerName: "Status", flex: 0.8, minWidth: 140 },
      { field: "createdAt", headerName: "Created", flex: 0.8, minWidth: 160 }
    ],
    []
  );

  const filteredNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return notifications.filter((item) => {
      if (statusFilter === "unread" && item.readAt) {
        return false;
      }
      if (statusFilter === "delivered" && !item.readAt) {
        return false;
      }
      if (query) {
        const haystack = `${item.title ?? ""} ${item.eventName ?? ""} ${item.eventKey ?? ""}`.toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });
  }, [notifications, statusFilter, searchTerm]);

  const rows = filteredNotifications.map((item) => ({
    id: item.id,
    title: item.title || "Notification",
    event: item.eventName || item.eventKey || "—",
    status: item.readAt ? "Delivered" : "Unread",
    createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"
  }));

  const toggleFilters = () => {
    if (!filtersOpen) {
      setDraftStatus(statusFilter);
      setDraftSearch(searchTerm);
    }
    setFiltersOpen((prev) => !prev);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setSearchTerm(draftSearch.trim());
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftStatus("all");
    setDraftSearch("");
    setStatusFilter("all");
    setSearchTerm("");
    setFiltersOpen(false);
  };

  const unreadCount = meta?.unread ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const hasActiveFilters = statusFilter !== "all" || Boolean(searchTerm);
  const statusFilterLabel =
    statusFilter === "all" ? "All notifications" : statusFilter === "unread" ? "Unread only" : "Delivered only";

  const filterPanel = (
    <div className="space-y-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          value={draftStatus}
          onChange={(event) => setDraftStatus(event.target.value as "all" | "unread" | "delivered")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="delivered">Delivered</option>
        </select>
      </label>
      <Input
        label="Search events"
        placeholder="Title or event key"
        value={draftSearch}
        onChange={(event) => setDraftSearch(event.target.value)}
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
          <h1 className="text-xl font-semibold text-slate-900">Notifications center</h1>
          <p className="text-sm text-slate-500">
            Inspect recent delivery events, drill into payloads, and jump over to the preference matrix.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div ref={filterMenuRef} className="relative">
            <Button variant={hasActiveFilters ? "primary" : "secondary"} onClick={toggleFilters}>
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
          <Button variant="secondary" onClick={() => navigate("/admin/notifications/preferences")}>
            Preferences
          </Button>
          <Button variant="primary" onClick={() => markAllAsRead()} disabled={!unreadCount}>
            Mark all read ({unreadCount})
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-slate-200 px-3 py-1">{statusFilterLabel}</span>
        {searchTerm && (
          <span className="rounded-full bg-slate-200 px-3 py-1">
            Search: &ldquo;{searchTerm.length > 24 ? `${searchTerm.slice(0, 24)}…` : searchTerm}&rdquo;
          </span>
        )}
        {!hasActiveFilters && <span className="text-slate-400">Showing entire event log</span>}
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loading />
          </div>
        ) : (
          <div className="space-y-3">
            <DataGrid rows={rows} columns={columns} loading={isFetching} />
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6 text-sm text-slate-600">
              <span>
                Page {page} of {totalPages} • {meta?.total ?? rows.length} total events
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Event catalog"
        description="Sourced from the backend notification registry. Use this list to confirm channels, keys, and escalation rules."
      >
        {prefsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loading />
          </div>
        ) : (
          <div className="space-y-4">
            {preferences.map((pref) => (
              <div
                key={pref.id || pref.event?.key}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-primary-200 hover:bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{pref.event?.name ?? pref.event?.key}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{pref.event?.key}</p>
                  </div>
                  {pref.event?.critical && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase text-rose-700">
                      Critical
                    </span>
                  )}
                </div>
                {pref.event?.description && <p className="mt-2 text-sm text-slate-600">{pref.event.description}</p>}
                <p className="mt-3 text-xs text-slate-500">
                  Default channels:{" "}
                  {(pref.event?.default_channels || pref.event?.supported_channels || [])
                    .map((channel) => channel.toUpperCase())
                    .join(", ") || "None"}
                </p>
              </div>
            ))}
            {preferences.length === 0 && (
              <p className="text-sm text-slate-500">No notification events have been registered yet.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminNotificationsPage;
