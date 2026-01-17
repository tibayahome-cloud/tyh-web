import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import BoltIcon from "@mui/icons-material/BoltOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { StickyActionBar } from "../../../../shared/components/StickyActionBar";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";
import { useRbac } from "../../../../shared/hooks/useRbac";
import { useSocket } from "../../../../shared/hooks/useSocket";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, providerProfile } from "../../../../shared/libs/fieldInclude";
import { useProviderDirectoryStore } from "../../store/useProviderDirectoryStore";

type SavedView = {
  id: string;
  label: string;
  description?: string;
  status: string;
  onlyEmergency: boolean;
  search?: string;
  isCustom?: boolean;
};

const STATUS_OPTIONS = [
  { label: "Verified providers", value: "verified" },
  { label: "All providers", value: "all" },
  { label: "Pending verification", value: "unverified" },
  { label: "Currently available", value: "available" },
  { label: "Offline", value: "offline" },
];

const STATIC_SAVED_VIEWS: SavedView[] = [
  {
    id: "ready-now",
    label: "Ready now",
    description: "Verified providers who are currently available for requests.",
    status: "available",
    onlyEmergency: false,
    search: "",
    isCustom: false,
  },
  {
    id: "emergency-ready",
    label: "Emergency-ready",
    description: "Verified and available providers with emergency capability.",
    status: "available",
    onlyEmergency: true,
    search: "",
    isCustom: false,
  },
  {
    id: "needs-review",
    label: "Needs review",
    description: "Providers awaiting verification or additional information.",
    status: "unverified",
    onlyEmergency: false,
    search: "",
    isCustom: false,
  },
] as const;

const PAGE_SIZE = 25;
const numberFormatter = new Intl.NumberFormat();

type ProviderUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

type ProviderService = {
  id: string;
  service_id?: string;
  active?: boolean;
  service?: {
    id?: string;
    name?: string | null;
    key?: string | null;
  };
};

type Provider = {
  id: string;
  user_id: string;
  verified: boolean;
  is_available: boolean;
  daily_request_limit: number;
  can_emergency: boolean;
  rating_avg?: number | string | null;
  rating_count?: number | null;
  user?: ProviderUser | null;
  services?: ProviderService[];
};

type Envelope<T, M = unknown> = {
  data: T;
  meta?: M;
};

type RawPageMeta = {
  number?: number;
  size?: number;
  total?: number;
  total_pages?: number;
};

type PageMeta = {
  number: number;
  size: number;
  total: number;
  totalPages: number;
};

type ProviderListResult = {
  items: Provider[];
  page: PageMeta;
};

type ProviderMetrics = {
  generated_at: string;
  totals: {
    total: number;
    verified: number;
    unverified: number;
    available: number;
  };
  applications: {
    pending_review: number;
    draft: number;
  };
  capacity: {
    emergency_capable: number;
    avg_daily_limit: number;
  };
};

type ProviderGridRow = {
  id: string;
  userId: string;
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  verified: boolean;
  availability: boolean;
  emergency: boolean;
  limit: number;
  ratingLabel: string;
  services: string;
};

type ConfirmState =
  | {
      title: string;
      description?: string;
      confirmLabel: string;
      confirmVariant?: "primary" | "secondary" | "danger";
      action: () => void;
    }
  | null;

type RowActionsProps = {
  row: ProviderGridRow;
  onManage: (row: ProviderGridRow) => void;
  onToggleAvailability?: (row: ProviderGridRow) => void;
  onToggleEmergency?: (row: ProviderGridRow) => void;
  disabled?: boolean;
};

const defaultPage: PageMeta = {
  number: 1,
  size: PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const mapRows = (providers: Provider[], page: PageMeta): ProviderGridRow[] => {
  return providers.map((provider, index) => {
    const user = provider.user ?? {};
    const ratingAvgRaw = typeof provider.rating_avg === "number" ? provider.rating_avg : Number(provider.rating_avg ?? 0);
    const ratingCount = provider.rating_count ?? 0;
    const ratingLabel = ratingCount > 0 ? `${ratingAvgRaw.toFixed(2)} (${ratingCount})` : "No ratings";

    const serviceNames =
      provider.services
        ?.filter((svc) => svc.active !== false)
        .map((svc) => svc.service?.name || svc.service?.key || svc.service_id || "")
        .filter((name) => Boolean(name))
        .join(", ") || "—";

    return {
      id: provider.id,
      userId: provider.user_id,
      rowNumber: (page.number - 1) * page.size + index + 1,
      name: user.full_name || user.email || user.phone || "Provider",
      email: user.email || "—",
      phone: user.phone || "—",
      verified: Boolean(provider.verified),
      availability: Boolean(provider.is_available),
      emergency: Boolean(provider.can_emergency),
      limit: provider.daily_request_limit ?? 0,
      ratingLabel,
      services: serviceNames,
    };
  });
};

const useProviderListQuery = (
  status: string,
  search: string,
  page: number,
  pageSize: number,
  onlyEmergency: boolean,
): { data: ProviderListResult | undefined; isLoading: boolean; isFetching: boolean } =>
  useQuery({
    queryKey: ["admin", "providers", "list", { status, search, page, pageSize, onlyEmergency }],
    queryFn: async () => {
      const params: Record<string, string> = {
        ...buildFieldParams(providerProfile),
        "page[number]": String(page),
        "page[size]": String(pageSize),
      };

      if (status === "verified") {
        params["filter[verified]"] = "true";
      } else if (status === "unverified") {
        params["filter[verified]"] = "false";
      }

      if (status === "available") {
        params["filter[available]"] = "true";
      } else if (status === "offline") {
        params["filter[available]"] = "false";
      }

      if (search) {
        params["filter[q]"] = search;
      }

      if (onlyEmergency) {
        params["filter[emergency]"] = "true";
      }

      const response = await api.get<Envelope<Provider[], { page?: RawPageMeta }>>("/providers", { params });
      const metaPage = response.data.meta?.page;
      const normalisedPage: PageMeta = {
        number: metaPage?.number ?? page,
        size: metaPage?.size ?? pageSize,
        total: metaPage?.total ?? (response.data.data?.length ?? 0),
        totalPages: metaPage?.total_pages ?? Math.max(1, Math.ceil((metaPage?.total ?? 0) / pageSize) || 1),
      };

      return {
        items: response.data.data ?? [],
        page: normalisedPage,
      };
    },
    keepPreviousData: true,
    staleTime: 30_000,
  });

const RowActions = ({ row, onManage, onToggleAvailability, onToggleEmergency, disabled }: RowActionsProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
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
            onManage(row);
          }}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Manage provider" />
        </MenuItem>
        {onToggleAvailability && (
          <MenuItem
            disabled={disabled}
            onClick={() => {
              handleClose();
              onToggleAvailability(row);
            }}
          >
            <ListItemIcon>
              <PowerSettingsNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={row.availability ? "Mark offline" : "Set available"} />
          </MenuItem>
        )}
        {onToggleEmergency && (
          <MenuItem
            disabled={disabled}
            onClick={() => {
              handleClose();
              onToggleEmergency(row);
            }}
          >
            <ListItemIcon>
              <BoltIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={row.emergency ? "Disable emergency" : "Enable emergency"} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

type ProviderCardProps = {
  row: ProviderGridRow;
  canManage: boolean;
  onManage: (row: ProviderGridRow) => void;
  onToggleAvailability?: (row: ProviderGridRow) => void;
  onToggleEmergency?: (row: ProviderGridRow) => void;
  disabled?: boolean;
};

const ProviderCard = ({
  row,
  canManage,
  onManage,
  onToggleAvailability,
  onToggleEmergency,
  disabled,
}: ProviderCardProps) => {
  const initials = useMemo(() => {
    return row.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "PR";
  }, [row.name]);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {initials}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">{row.name}</p>
              <p className="text-sm text-slate-600">{row.email}</p>
              {row.phone !== "—" && <p className="text-xs text-slate-500">{row.phone}</p>}
            </div>
          </div>
          {canManage && (
            <RowActions
              row={row}
              onManage={onManage}
              onToggleAvailability={onToggleAvailability}
              onToggleEmergency={onToggleEmergency}
              disabled={disabled}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={classNames(
              "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              row.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
            )}
          >
            {row.verified ? "Verified" : "Pending"}
          </span>
          <span
            className={classNames(
              "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              row.availability ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600",
            )}
          >
            {row.availability ? "Available" : "Offline"}
          </span>
          {row.emergency && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
              Emergency-ready
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Daily limit</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{row.limit}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Rating</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{row.ratingLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Services</dt>
            <dd className="mt-0.5 line-clamp-2 text-slate-900">{row.services || "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => onManage(row)} className="flex-1" type="button">
          Manage
        </Button>
        {canManage && (
          <>
            <Button
              variant="secondary"
              onClick={() => onToggleAvailability?.(row)}
              className="flex-1"
              disabled={disabled}
              type="button"
            >
              {row.availability ? "Mark offline" : "Set available"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onToggleEmergency?.(row)}
              className="flex-1"
              disabled={disabled}
              type="button"
            >
              {row.emergency ? "Disable emergency" : "Enable emergency"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
const DirectoryPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { hasPermission } = useRbac();

  const canManageProviders = hasPermission("provider:verify");

  const [statusFilter, setStatusFilter] = useState("verified");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [onlyEmergency, setOnlyEmergency] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewDescription, setNewViewDescription] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    status: statusFilter,
    search: searchInput,
    emergency: onlyEmergency,
  });
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileFilters = useMediaQuery("(max-width: 640px)");
  const customSavedViews = useProviderDirectoryStore((state) => state.savedViews);
  const addView = useProviderDirectoryStore((state) => state.addView);
  const removeView = useProviderDirectoryStore((state) => state.removeView);
  const defaultViewId = useProviderDirectoryStore((state) => state.defaultViewId);
  const setDefaultView = useProviderDirectoryStore((state) => state.setDefaultView);

  const customViewEntries = useMemo<SavedView[]>(
    () =>
      customSavedViews.map((view) => ({
        ...view,
        isCustom: true,
        search: view.search ?? "",
      })),
    [customSavedViews],
  );

  const combinedViews = useMemo<SavedView[]>(
    () => [...STATIC_SAVED_VIEWS, ...customViewEntries],
    [customViewEntries],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

useEffect(() => {
  setPage(1);
}, [statusFilter, searchTerm, onlyEmergency]);

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

  const invalidateProviders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "providers", "list"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "providers", "metrics"] });
  }, [queryClient]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const refresh = () => invalidateProviders();
    const handleNotification = (payload: { event_key?: string }) => {
      if (payload?.event_key?.startsWith("provider.")) {
        refresh();
      }
    };

    socket.on("model.provider.onboarding.bootstrap", refresh);
    socket.on("model.provider.updated", refresh);
    socket.on("notification.created", handleNotification);

    return () => {
      socket.off("model.provider.onboarding.bootstrap", refresh);
      socket.off("model.provider.updated", refresh);
      socket.off("notification.created", handleNotification);
    };
  }, [socket, invalidateProviders]);

  const metricsQuery = useQuery({
    queryKey: ["admin", "providers", "metrics"],
    queryFn: async () => {
      const response = await api.get<Envelope<ProviderMetrics>>("/providers/metrics");
      return response.data.data;
    },
    enabled: canManageProviders,
    staleTime: 60_000,
  });

  const { data: listData, isLoading, isFetching } = useProviderListQuery(statusFilter, searchTerm, page, PAGE_SIZE, onlyEmergency);
  const rows = useMemo(() => mapRows(listData?.items ?? [], listData?.page ?? defaultPage), [listData]);
  const pageInfo = listData?.page ?? defaultPage;
  const showingFrom = rows.length ? (pageInfo.number - 1) * pageInfo.size + 1 : 0;
  const showingTo = rows.length ? showingFrom + rows.length - 1 : 0;
  const isLastPage = pageInfo.number >= pageInfo.totalPages;

  const availabilityMutation = useMutation({
    mutationFn: async ({ userId, isAvailable }: { userId: string; isAvailable: boolean }) => {
      await api.patch(`/providers/${userId}`, { is_available: isAvailable });
    },
    onSuccess: () => {
      toast.showToast({
        title: "Provider updated",
        description: "Availability changes saved.",
        variant: "success",
      });
      invalidateProviders();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update provider",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error",
      });
    },
    onSettled: () => {
      setConfirmState(null);
    },
  });

  const emergencyMutation = useMutation({
    mutationFn: async ({ userId, canEmergency }: { userId: string; canEmergency: boolean }) => {
      await api.patch(`/providers/${userId}`, { can_emergency: canEmergency });
    },
    onSuccess: () => {
      toast.showToast({
        title: "Provider updated",
        description: "Emergency capability updated.",
        variant: "success",
      });
      invalidateProviders();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update provider",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error",
      });
    },
    onSettled: () => {
      setConfirmState(null);
    },
  });

  const handleManage = useCallback(
    (row: ProviderGridRow) => {
      navigate(`/admin/providers/${row.userId}`);
    },
    [navigate],
  );

  const handleToggleAvailability = useCallback(
    (row: ProviderGridRow) => {
      setConfirmState({
        title: row.availability ? "Mark provider offline" : "Set provider available",
        description: row.availability
          ? "The provider will no longer appear as available for requests."
          : "The provider will be marked as available to receive requests.",
        confirmLabel: row.availability ? "Mark offline" : "Set available",
        confirmVariant: row.availability ? "secondary" : "primary",
        action: () =>
          availabilityMutation.mutate({
            userId: row.userId,
            isAvailable: !row.availability,
          }),
      });
    },
    [availabilityMutation],
  );

  const handleToggleEmergency = useCallback(
    (row: ProviderGridRow) => {
      setConfirmState({
        title: row.emergency ? "Disable emergency capability" : "Enable emergency capability",
        description: row.emergency
          ? "The provider will no longer be flagged for emergency jobs."
          : "The provider will be flagged as eligible for emergency requests.",
        confirmLabel: row.emergency ? "Disable" : "Enable",
        confirmVariant: row.emergency ? "secondary" : "primary",
        action: () =>
          emergencyMutation.mutate({
            userId: row.userId,
            canEmergency: !row.emergency,
          }),
      });
    },
    [emergencyMutation],
  );

  const metrics = metricsQuery.data;
  const metricCards = metrics
    ? [
        {
          label: "Total providers",
          primary: numberFormatter.format(metrics.totals.total),
          secondary: `${numberFormatter.format(metrics.totals.verified)} verified • ${numberFormatter.format(metrics.totals.unverified)} pending`,
        },
        {
          label: "Availability",
          primary: numberFormatter.format(metrics.totals.available),
          secondary: `${numberFormatter.format(metrics.capacity.emergency_capable)} emergency-ready`,
        },
        {
          label: "Onboarding queue",
          primary: numberFormatter.format(metrics.applications.pending_review),
          secondary: `${numberFormatter.format(metrics.applications.draft)} drafts in progress`,
        },
        {
          label: "Daily capacity",
          primary: `${numberFormatter.format(Math.round(metrics.capacity.avg_daily_limit || 0))} jobs`,
          secondary: "Average daily limit",
        },
      ]
    : [];

  const dialogLoading = availabilityMutation.isPending || emergencyMutation.isPending;
  const applySavedView = useCallback(
    (viewId: string) => {
      const view = combinedViews.find((candidate) => candidate.id === viewId);
      if (!view) {
        return;
      }
      setStatusFilter(view.status);
      setOnlyEmergency(view.onlyEmergency);
      const searchValue = view.search ?? "";
      setSearchInput(searchValue);
      setSearchTerm(searchValue);
    },
    [combinedViews, setStatusFilter, setOnlyEmergency, setSearchInput, setSearchTerm],
  );

  const activeSavedViewId =
    combinedViews.find(
      (view) =>
        view.status === statusFilter &&
        view.onlyEmergency === onlyEmergency &&
        (view.search ?? "") === (searchTerm || ""),
    )?.id ?? null;

  const isLoadingList = isLoading && !listData;
  const isEmpty = !isLoadingList && rows.length === 0;
  const resetFilters = useCallback(() => {
    setStatusFilter("verified");
    setOnlyEmergency(false);
    setSearchInput("");
    setSearchTerm("");
  }, [setStatusFilter, setOnlyEmergency, setSearchInput, setSearchTerm]);
  const openFilterMenu = useCallback(() => {
    setDraftFilters({
      status: statusFilter,
      search: searchInput,
      emergency: onlyEmergency,
    });
    setFiltersOpen(true);
  }, [onlyEmergency, searchInput, statusFilter]);

  const applyFilterChanges = useCallback(() => {
    setStatusFilter(draftFilters.status);
    setOnlyEmergency(draftFilters.emergency);
    setSearchInput(draftFilters.search);
    setFiltersOpen(false);
  }, [draftFilters, setOnlyEmergency, setSearchInput, setStatusFilter]);

  const clearFilterChanges = useCallback(() => {
    setDraftFilters({
      status: "verified",
      search: "",
      emergency: false,
    });
    resetFilters();
    setFiltersOpen(false);
  }, [resetFilters]);
  const canSaveNewView = newViewName.trim().length > 0;
  const handleCloseManageModal = useCallback(() => {
    setManageModalOpen(false);
    setNewViewName("");
    setNewViewDescription("");
  }, []);
  const handleSaveView = useCallback(() => {
    if (!canSaveNewView) {
      return;
    }
    const id = `custom-${Date.now()}`;
    addView({
      id,
      label: newViewName.trim(),
      description: newViewDescription.trim() || undefined,
      status: statusFilter,
      onlyEmergency,
      search: searchTerm || undefined,
    });
    toast.showToast({
      title: "View saved",
      description: "You can find it under saved views.",
      variant: "success",
    });
    handleCloseManageModal();
  }, [
    addView,
    canSaveNewView,
    handleCloseManageModal,
    newViewDescription,
    newViewName,
    onlyEmergency,
    searchTerm,
    statusFilter,
    toast,
  ]);
  const handleRemoveView = useCallback(
    (id: string) => {
      removeView(id);
      toast.showToast({
        title: "View removed",
        description: "It is no longer available under saved views.",
        variant: "info",
      });
      if (activeSavedViewId === id) {
        resetFilters();
      }
    },
    [activeSavedViewId, removeView, resetFilters, toast],
  );
  const describeViewFilters = useCallback((view: SavedView) => {
    const statusLabel = STATUS_OPTIONS.find((option) => option.value === view.status)?.label ?? view.status;
    const parts = [statusLabel];
    if (view.onlyEmergency) {
      parts.push("Emergency capable");
    }
    if (view.search) {
      parts.push(`Search: "${view.search}"`);
    }
    return parts.join(" • ");
  }, []);

  const statusFilterLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? statusFilter;
  const filterSummaryChips = useMemo(() => {
    const chips = [`Status: ${statusFilterLabel}`];
    if (onlyEmergency) {
      chips.push("Emergency capable");
    }
    if (searchTerm) {
      chips.push(`Search: “${searchTerm.length > 24 ? `${searchTerm.slice(0, 24)}…` : searchTerm}”`);
    }
    return chips;
  }, [onlyEmergency, searchTerm, statusFilterLabel]);
  const filtersApplied = statusFilter !== "verified" || onlyEmergency || Boolean(searchTerm);
  const showAllFiltersText = statusFilter === "verified" && !onlyEmergency && !searchTerm;

  const filterPanel = (
    <div className="space-y-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          value={draftFilters.status}
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          checked={draftFilters.emergency}
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, emergency: event.target.checked }))}
        />
        Emergency capable only
      </label>
      <Input
        label="Search directory"
        placeholder="Search name, email, or phone"
        value={draftFilters.search}
        onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))}
      />
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={clearFilterChanges}>
          Clear
        </Button>
        <Button type="button" onClick={applyFilterChanges}>
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      {canManageProviders && (
        <section>
          {metricsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`provider-metric-skeleton-${index}`}
                  className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((item) => (
                <Card key={item.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{item.primary}</p>
                  {item.secondary && <p className="mt-1 text-xs text-slate-500">{item.secondary}</p>}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <Card title="Directory controls" description="Use saved views and filters to focus on the providers that need your attention.">
        <div className="space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" onClick={() => navigate("/admin/providers/onboarding")}>
              New provider
            </Button>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">Saved views</p>
              <Button
                variant="ghost"
                className="text-sm text-primary-600"
                type="button"
                onClick={() => setManageModalOpen(true)}
              >
                Manage views
              </Button>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {combinedViews.map((view) => {
                const isActive = activeSavedViewId === view.id;
                const isDefault = defaultViewId === view.id;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => applySavedView(view.id)}
                    className={classNames(
                      "min-w-[220px] rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:border-primary-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                      isActive ? "border-primary-500 bg-primary-50 text-primary-700" : "border-slate-200 bg-white",
                    )}
                  >
                    <p className="text-sm font-semibold leading-tight">{view.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{view.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {view.isCustom && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 font-medium text-primary-700">
                          Custom
                        </span>
                      )}
                      {isDefault && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                          Default
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div ref={filterMenuRef} className="relative inline-flex">
              <Button variant={filtersApplied ? "primary" : "secondary"} onClick={openFilterMenu} className="inline-flex items-center gap-2">
                Filters
                {filtersApplied && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Active</span>
                )}
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              {filterSummaryChips.map((chip) => (
                <span key={chip} className="rounded-full bg-slate-200 px-3 py-1">
                  {chip}
                </span>
              ))}
              {showAllFiltersText && <span className="text-slate-400">Default filters</span>}
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 focus:outline-none"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </Card>

      {isLoadingList ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`provider-skeleton-${index}`}
              className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <Card>
          <div className="space-y-3 text-center text-slate-600">
            <p className="text-sm">No providers match the selected filters.</p>
            <Button variant="secondary" onClick={resetFilters} type="button">
              Clear filters
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <ProviderCard
              key={row.id}
              row={row}
              canManage={canManageProviders}
              onManage={handleManage}
              onToggleAvailability={canManageProviders ? handleToggleAvailability : undefined}
              onToggleEmergency={canManageProviders ? handleToggleEmergency : undefined}
              disabled={dialogLoading}
            />
          ))}
        </div>
      )}

      <StickyActionBar align="between">
        <span className="text-xs text-slate-500">
          Showing {showingFrom || 0}-{showingTo || 0} of {numberFormatter.format(pageInfo.total)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            type="button"
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={isLastPage || isFetching}
            onClick={() => setPage((prev) => prev + 1)}
            type="button"
          >
            Next
          </Button>
        </div>
      </StickyActionBar>

      <Modal open={manageModalOpen} onClose={handleCloseManageModal} title="Manage saved views">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Save the current filters as a reusable view to jump back quickly later.
            </p>
            <Input
              label="View name"
              placeholder="e.g. Emergency-ready Nairobi"
              value={newViewName}
              onChange={(event) => setNewViewName(event.target.value)}
            />
            <Input
              label="Description (optional)"
              placeholder="Shown in the saved views list"
              value={newViewDescription}
              onChange={(event) => setNewViewDescription(event.target.value)}
            />
            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveView} disabled={!canSaveNewView}>
                Save view
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Custom views</p>
            {customViewEntries.length === 0 ? (
              <p className="text-sm text-slate-500">
                You haven&apos;t saved any custom views yet. Configure filters above and click &quot;Save view&quot; to add one.
              </p>
            ) : (
              <ul className="space-y-3">
                {customViewEntries.map((view) => (
                  <li key={view.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{view.label}</p>
                        {view.description && <p className="text-xs text-slate-500">{view.description}</p>}
                        <p className="text-xs text-slate-400">{describeViewFilters(view)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" type="button" onClick={() => applySavedView(view.id)}>
                          Apply
                        </Button>
                        <Button variant="ghost" type="button" onClick={() => handleRemoveView(view.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Default view</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="radio"
                  name="default-directory-view"
                  value=""
                  checked={!defaultViewId}
                  onChange={() => setDefaultView(undefined)}
                />
                <span>No default</span>
              </label>
              {combinedViews.map((view) => (
                <label key={`default-${view.id}`} className="flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:gap-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="default-directory-view"
                      value={view.id}
                      checked={defaultViewId === view.id}
                      onChange={() => setDefaultView(view.id)}
                    />
                    <span className="font-medium text-slate-800">{view.label}</span>
                  </span>
                  <span className="text-xs text-slate-400">{describeViewFilters(view) || "No filters"}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        confirmVariant={confirmState?.confirmVariant}
        loading={dialogLoading}
        onConfirm={() => confirmState?.action()}
        onClose={() => {
          if (!dialogLoading) {
            setConfirmState(null);
          }
        }}
      />
    </div>
  );
};

export default DirectoryPage;
