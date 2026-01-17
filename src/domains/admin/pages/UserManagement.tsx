import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GridColDef } from "@mui/x-data-grid";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { DataGrid } from "../../../shared/components/DataGrid";
import { Input } from "../../../shared/components/Input";
import { Loading } from "../../../shared/components/Loading";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { useRbac } from "../../../shared/hooks/useRbac";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, userAdminList } from "../../../shared/libs/fieldInclude";
import { AddUserDialog } from "../components/AddUserDialog";

type Role = {
  id: string;
  key: string;
  name: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string | null;
  roles?: Role[];
};

type PagePayload = {
  number?: number;
  size?: number;
  total?: number;
  total_pages?: number;
};

type Envelope<T, M = unknown> = {
  data: T;
  meta?: M;
};

type PageMeta = {
  number: number;
  size: number;
  total: number;
  totalPages: number;
};

type UserListResult = {
  items: UserRow[];
  page: PageMeta;
};

type UserMetrics = {
  generated_at: string;
  totals: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
  };
  verification: {
    email_verified: number;
    email_rate?: number;
    phone_verified: number;
    phone_rate?: number;
  };
  two_factor: {
    enabled: number;
    enabled_rate?: number;
    enrolled: number;
  };
  recent: {
    last_24h: number;
    last_7d: number;
  };
};

type UserGridRow = {
  id: string;
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  roles: string;
  createdAt: string;
};

type DialogState = {
  mode: "suspend" | "delete";
  user: {
    id: string;
    name: string;
  };
};

type RowActionsProps = {
  row: UserGridRow;
  onView: (row: UserGridRow) => void;
  onSuspend?: (row: UserGridRow) => void;
  onDelete?: (row: UserGridRow) => void;
  canSuspend?: boolean;
  canDelete?: boolean;
};

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Suspended", value: "suspended" },
];

const PAGE_SIZE = 25;
const defaultPage: PageMeta = { number: 1, size: PAGE_SIZE, total: 0, totalPages: 1 };

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const numberFormatter = new Intl.NumberFormat();
const percentFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const formatPercent = (value?: number) => `${percentFormatter.format(value ?? 0)}%`;

const extractErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const data = error.response?.data as { data?: { message?: string }; meta?: { message?: string } } | undefined;
    return (
      data?.meta?.message ??
      (typeof data?.data === "object" && data?.data && "message" in data.data
        ? String((data.data as { message?: string }).message)
        : error.message)
    );
  }
  return "Request failed";
};

const RowActions = ({ row, onView, onSuspend, onDelete, canSuspend, canDelete }: RowActionsProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: ReactMouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <IconButton size="small" onClick={handleOpen} aria-label={`Actions for ${row.name}`}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose} elevation={3}>
        <MenuItem
          onClick={() => {
            handleClose();
            onView(row);
          }}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="View" />
        </MenuItem>
        {canSuspend && onSuspend && (
          <MenuItem
            disabled={row.status.toLowerCase() === "suspended"}
            onClick={() => {
              handleClose();
              onSuspend(row);
            }}
          >
            <ListItemIcon>
              <BlockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Suspend" />
          </MenuItem>
        )}
        {canDelete && onDelete && (
          <MenuItem
            onClick={() => {
              handleClose();
              onDelete(row);
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Delete" />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

const mapRows = (users: UserRow[], page: PageMeta): UserGridRow[] =>
  users.map((user, index) => ({
    id: user.id,
    rowNumber: (page.number - 1) * page.size + index + 1,
    name: user.full_name || "—",
    email: user.email || "—",
    phone: user.phone || "—",
    status: user.status,
    roles: user.roles?.map((role) => role.name || role.key).join(", ") || "—",
    createdAt: user.created_at ? dateFormatter.format(new Date(user.created_at)) : "—",
  }));

const useUserListQuery = (status: string, search: string, page: number, pageSize: number) =>
  useQuery<UserListResult>({
    queryKey: ["admin", "users", "list", { status, search, page, pageSize }],
    queryFn: async () => {
      const params: Record<string, string> = {
        ...buildFieldParams(userAdminList),
        "page[number]": String(page),
        "page[size]": String(pageSize),
        sort: "-created_at",
      };
      if (status !== "all") {
        params["filter[status]"] = status;
      }
      if (search) {
        params["filter[search]"] = search;
      }

      const response = await api.get<Envelope<UserRow[], { page?: PagePayload }>>("/users", { params });
      const metaPage = response.data.meta?.page;

      return {
        items: response.data.data,
        page: {
          number: metaPage?.number ?? page,
          size: metaPage?.size ?? pageSize,
          total: metaPage?.total ?? response.data.data.length,
          totalPages: metaPage?.total_pages ?? 1,
        },
      };
    },
    keepPreviousData: true,
  });

const MetricCard = ({ label, primary, secondary }: { label: string; primary: string; secondary?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900">{primary}</p>
    {secondary && <p className="mt-0.5 text-xs text-slate-500">{secondary}</p>}
  </div>
);

const UserManagementPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useRbac();

  const canCreateUser = hasPermission("user:create");
  const canSuspendUser = hasPermission("user:update");
  const canDeleteUser = hasPermission("user:delete");

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState(statusFilter);
  const [draftSearch, setDraftSearch] = useState(searchInput);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const isMobileFilter = useMediaQuery("(max-width: 640px)");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (!filtersOpen || isMobileFilter) {
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
  }, [filtersOpen, filterMenuRef, isMobileFilter]);

  const metricsQuery = useQuery({
    queryKey: ["admin", "users", "metrics"],
    queryFn: async () => {
      const response = await api.get<Envelope<UserMetrics>>("/users/metrics");
      return response.data.data;
    },
    staleTime: 60_000,
  });

  const { data: listData, isLoading, isFetching } = useUserListQuery(statusFilter, searchTerm, page, PAGE_SIZE);

  const rows = useMemo(() => mapRows(listData?.items ?? [], listData?.page ?? defaultPage), [listData]);
  const pageInfo = listData?.page ?? defaultPage;
  const showingFrom = rows.length ? (pageInfo.number - 1) * pageInfo.size + 1 : 0;
  const showingTo = rows.length ? showingFrom + rows.length - 1 : 0;
  const isLastPage = pageInfo.number >= pageInfo.totalPages;

  const handleView = useCallback(
    (row: UserGridRow) => {
      navigate(`/admin/users/${row.id}`);
    },
    [navigate],
  );

  const handleSuspendRequest = useCallback(
    (row: UserGridRow) => {
      setDialogError(null);
      setDialogState({
        mode: "suspend",
        user: { id: row.id, name: row.name },
      });
    },
    [],
  );

  const handleDeleteRequest = useCallback(
    (row: UserGridRow) => {
      setDialogError(null);
      setDialogState({
        mode: "delete",
        user: { id: row.id, name: row.name },
      });
    },
    [],
  );

  const closeDialog = () => {
    setDialogState(null);
    setDialogError(null);
  };

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users", "list"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users", "metrics"] });
  };

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/auth/users/${userId}/suspend`, { reason: "admin_suspend" });
    },
    onSuccess: () => {
      invalidateUsers();
      closeDialog();
    },
    onError: (error) => {
      setDialogError(extractErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`, { data: { reason: "admin_delete" } });
    },
    onSuccess: () => {
      invalidateUsers();
      closeDialog();
    },
    onError: (error) => {
      setDialogError(extractErrorMessage(error));
    },
  });

  const confirmLoading = suspendMutation.isPending || deleteMutation.isPending;

  const columns = useMemo<GridColDef[]>(() => {
    const base: GridColDef[] = [
      { field: "rowNumber", headerName: "#", width: 70, sortable: false },
      { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
      { field: "email", headerName: "Email", flex: 1.2, minWidth: 200 },
      { field: "phone", headerName: "Phone", flex: 1, minWidth: 150 },
      {
        field: "status",
        headerName: "Status",
        minWidth: 130,
        renderCell: ({ value }) => (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {value}
          </span>
        ),
      },
      { field: "roles", headerName: "Roles", flex: 1.5, minWidth: 220 },
      { field: "createdAt", headerName: "Joined", minWidth: 140 },
    ];

    base.push({
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      width: 72,
      align: "center",
      renderCell: (params) => (
        <RowActions
          row={params.row as UserGridRow}
          onView={handleView}
          onSuspend={canSuspendUser ? handleSuspendRequest : undefined}
          onDelete={canDeleteUser ? handleDeleteRequest : undefined}
          canSuspend={canSuspendUser}
          canDelete={canDeleteUser}
        />
      ),
    });

    return base;
  }, [canDeleteUser, canSuspendUser, handleDeleteRequest, handleSuspendRequest, handleView]);

  const metrics = metricsQuery.data;

  const metricCards = metrics
    ? [
        {
          label: "Total users",
          primary: numberFormatter.format(metrics.totals.total),
          secondary: `${metrics.totals.active} active • ${metrics.totals.suspended} suspended`,
        },
        {
          label: "Pending approvals",
          primary: numberFormatter.format(metrics.totals.pending),
          secondary: `New (24h): ${numberFormatter.format(metrics.recent.last_24h)}`,
        },
        {
          label: "Verification",
          primary: `${formatPercent(metrics.verification.email_rate)} email`,
          secondary: `${metrics.verification.phone_verified} phone verified`,
        },
        {
          label: "Two-factor",
          primary: `${metrics.two_factor.enabled} enabled`,
          secondary: `Adoption ${formatPercent(metrics.two_factor.enabled_rate)}`,
        },
      ]
    : [];

  const hasActiveFilters = statusFilter !== "all" || Boolean(searchInput.trim());

  const dialogTitle =
    dialogState?.mode === "delete" ? "Delete user?" : dialogState?.mode === "suspend" ? "Suspend user?" : undefined;
  const dialogDescription =
    dialogState?.mode === "delete"
      ? "Deleting will revoke all sessions and archive this account. You can restore it later if needed."
      : dialogState?.mode === "suspend"
      ? "Suspended users cannot sign in until you reactivate them."
      : undefined;
  const dialogConfirmLabel = dialogState?.mode === "delete" ? "Delete user" : "Suspend user";

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    invalidateUsers();
  };

  const toggleFilterMenu = () => {
    if (!filtersOpen) {
      setDraftStatusFilter(statusFilter);
      setDraftSearch(searchInput);
    }
    setFiltersOpen((prev) => !prev);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatusFilter);
    setSearchInput(draftSearch);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftStatusFilter("all");
    setDraftSearch("");
    setStatusFilter("all");
    setSearchInput("");
    setFiltersOpen(false);
  };

  const filterPanel = (
    <div className="space-y-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          value={draftStatusFilter}
          onChange={(event) => setDraftStatusFilter(event.target.value)}
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
        label="Search"
        placeholder="Search name, email, or phone"
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
      <section>
        {metricsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`metric-skeleton-${index}`} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((item) => (
              <MetricCard key={item.label} label={item.label} primary={item.primary} secondary={item.secondary} />
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div ref={filterMenuRef} className="relative inline-flex">
            <Button
              variant={hasActiveFilters ? "primary" : "secondary"}
              onClick={toggleFilterMenu}
              className="inline-flex items-center gap-2"
            >
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  {statusFilter === "all" ? "All" : "Custom"}
                </span>
              )}
            </Button>
            {filtersOpen &&
              (isMobileFilter ? (
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
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-200 px-3 py-1">
              Status: {STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? "All statuses"}
            </span>
            {searchInput && (
              <span className="rounded-full bg-slate-200 px-3 py-1">
                Search: &ldquo;{searchInput.length > 24 ? `${searchInput.slice(0, 24)}…` : searchInput}&rdquo;
              </span>
            )}
            {!hasActiveFilters && <span className="text-slate-400">All filters</span>}
          </div>
        </div>
        {canCreateUser && (
          <Button className="self-start" onClick={() => setIsCreateOpen(true)}>
            Add user
          </Button>
        )}
      </div>

      <Card padding="none">
        {isLoading && !listData ? (
          <div className="p-6">
            <Loading />
          </div>
        ) : (
          <>
            <DataGrid rows={rows} columns={columns} loading={isFetching} />
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <span>
                Showing {showingFrom || 0}-{showingTo || 0} of {numberFormatter.format(pageInfo.total)}
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
                  disabled={isLastPage || isFetching}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <AddUserDialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={handleCreateSuccess} />

      <ConfirmDialog
        open={Boolean(dialogState)}
        title={dialogTitle}
        description={
          dialogState && dialogDescription
            ? `${dialogDescription} (${dialogState.user.name || "user"})`
            : dialogDescription
        }
        error={dialogError ?? undefined}
        confirmLabel={dialogConfirmLabel}
        confirmVariant="primary"
        loading={confirmLoading}
        onClose={closeDialog}
        onConfirm={() => {
          if (!dialogState) {
            return;
          }
          if (dialogState.mode === "suspend") {
            suspendMutation.mutate(dialogState.user.id);
          } else {
            deleteMutation.mutate(dialogState.user.id);
          }
        }}
      />
    </div>
  );
};

export default UserManagementPage;
