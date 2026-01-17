import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import classNames from "classnames";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { Input } from "../../../../shared/components/Input";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, provApp, reqType } from "../../../../shared/libs/fieldInclude";
import { useSocket } from "../../../../shared/hooks/useSocket";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";
import { ProviderRequirementsPanel } from "./RequirementsPage";

type RequirementSummary = {
  id: string;
  status: string;
  value_text?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  comment?: string | null;
  requirement_type?: {
    id: string;
    label: string;
    input_type: string;
  };
};

type ProviderApplication = {
  id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
  user?: {
    id: string;
    full_name?: string;
    email?: string;
  };
  items?: RequirementSummary[];
};

type RequirementType = {
  id: string;
  key: string;
  label: string;
  input_type: string;
  is_universal: boolean;
  is_sensitive: boolean;
  is_active: boolean;
  display_order?: number | null;
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

type ApplicationPage = {
  items: ProviderApplication[];
  page: PageMeta;
};

const STATUSES = [
  { value: "submitted", label: "Awaiting review" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" }
];

const dateTime = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const PAGE_SIZE = 18;

const useApplicationsQuery = (status: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: ["admin", "provider-applications", status],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const params = {
        ...buildFieldParams(provApp),
        ...(status ? { "filter[status]": status } : {}),
        "page[number]": String(pageParam),
        "page[size]": String(PAGE_SIZE)
      };
      const response = await api.get<Envelope<ProviderApplication[], { page?: RawPageMeta }>>("/provider-applications", {
        params
      });
      const meta = response.data.meta?.page ?? {};
      const page: PageMeta = {
        number: meta.number ?? pageParam,
        size: meta.size ?? PAGE_SIZE,
        total: meta.total ?? response.data.data?.length ?? 0,
        totalPages: meta.total_pages ?? Math.max(
          1,
          Math.ceil((meta.total ?? response.data.data?.length ?? 0) / (meta.size ?? PAGE_SIZE))
        )
      };
      return {
        items: response.data.data ?? [],
        page
      } satisfies ApplicationPage;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page.number >= lastPage.page.totalPages) {
        return undefined;
      }
      return lastPage.page.number + 1;
    },
    enabled
  });

const useApplicationDetailQuery = (id: string | null) => {
  return useQuery({
    queryKey: ["admin", "provider-applications", id, "detail"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) {
        return null;
      }
      const params = buildFieldParams(provApp);
      const response = await api.get<Envelope<ProviderApplication>>(`/provider-applications/${id}`, { params });
      return response.data.data;
    }
  });
};

const useRequirementTypesQuery = () =>
  useQuery({
    queryKey: ["admin", "provider-requirements"],
    queryFn: async () => {
      const params = buildFieldParams(reqType);
      const response = await api.get<Envelope<RequirementType[]>>("/requirements", { params });
      return response.data.data;
    }
  });

const ProviderApplicationsPage = () => {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam === "requirements" ? "requirements" : "applications");

  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [draftStatusFilter, setDraftStatusFilter] = useState("all");
  const [draftSearchTerm, setDraftSearchTerm] = useState("");

  useEffect(() => {
    const next = tabParam === "requirements" ? "requirements" : "applications";
    setActiveTab(next);
  }, [tabParam]);

  const handleTabChange = (value: "applications" | "requirements") => {
    const nextParams = new URLSearchParams(params);
    if (value === "applications") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", value);
    }
    setParams(nextParams, { replace: true });
    setActiveTab(value);
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (activeTab !== "applications") {
      setSelectedId(null);
    }
  }, [activeTab]);

  const [addRequirementOpen, setAddRequirementOpen] = useState(false);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>("");
  const [resubmissionItem, setResubmissionItem] = useState<RequirementSummary | null>(null);
  const [resubmissionNote, setResubmissionNote] = useState("");
  const [resubmissionError, setResubmissionError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileFilters = useMediaQuery("(max-width: 640px)");
  const toast = useToast();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage
  } = useApplicationsQuery(statusFilter === "all" ? "" : statusFilter, activeTab === "applications");
  const { data: detail, isFetching: detailLoading } = useApplicationDetailQuery(selectedId);
  const requirementsQuery = useRequirementTypesQuery();
  const applicationPages = useMemo(() => data?.pages ?? [], [data]);
  const applications = useMemo(
    () => applicationPages.flatMap((page) => page.items),
    [applicationPages]
  );

  const [confirmState, setConfirmState] = useState<{ action: "approved" | "rejected"; id: string } | null>(null);

  useEffect(() => {
    if (isError) {
      toast.showToast({
        title: "Unable to load applications",
        description: error instanceof Error ? error.message : "Refresh the page or try again shortly.",
        variant: "error"
      });
    }
  }, [isError, error, toast]);

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
  }, [filtersOpen, filterMenuRef, isMobileFilters]);

  useEffect(() => {
    if (activeTab !== "applications") {
      return;
    }
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "160px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeTab, fetchNextPage, hasNextPage, isFetchingNextPage, applicationPages.length]);

  const openAddRequirement = () => {
    setSelectedRequirementId("");
    setAddRequirementOpen(true);
  };

  const closeAddRequirement = () => {
    setAddRequirementOpen(false);
    setSelectedRequirementId("");
  };

  const openResubmission = (item: RequirementSummary) => {
    setResubmissionItem(item);
    setResubmissionNote(item.comment ?? "");
    setResubmissionError(null);
  };

  const closeResubmission = () => {
    setResubmissionItem(null);
    setResubmissionNote("");
    setResubmissionError(null);
  };

  useEffect(() => {
    if (!socket) {
      return;
    }

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications"] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications", selectedId, "detail"] });
      }
    };

    const handleNotification = (payload: { event_key?: string }) => {
      if (!payload?.event_key?.startsWith("provider.application")) {
        return;
      }
      refresh();
    };

    socket.on("model.provider.onboarding.bootstrap", refresh);
    socket.on("notification.created", handleNotification);

    return () => {
      socket.off("model.provider.onboarding.bootstrap", refresh);
      socket.off("notification.created", handleNotification);
    };
  }, [socket, queryClient, selectedId]);

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: "approved" | "rejected"; notes?: string }) => {
      await api.post(`/provider-applications/${id}/review`, { decision, notes });
    },
    onSuccess: (_, variables) => {
      toast.showToast({
        title: variables.decision === "approved" ? "Application approved" : "Application rejected",
        description:
          variables.decision === "approved"
            ? "The provider has been verified and notified."
            : "The applicant has been notified of the decision.",
        variant: variables.decision === "approved" ? "success" : "info"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      setSelectedId(null);
      setConfirmState(null);
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to complete review",
        description: error instanceof Error ? error.message : "Try again or refresh the page.",
        variant: "error"
      });
    },
    onSettled: () => {
      setConfirmState(null);
    }
  });

  const addRequirementMutation = useMutation({
    mutationFn: async (requirementId: string) => {
      if (!selectedId) {
        throw new Error("Select an application to continue");
      }
      await api.post(`/provider-applications/${selectedId}/requirements`, {
        requirement_type_id: requirementId
      });
    },
    onSuccess: () => {
      toast.showToast({
        title: "Requirement added",
        description: "The checklist has been updated for this provider.",
        variant: "success"
      });
      closeAddRequirement();
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications", selectedId, "detail"] });
      }
      requirementsQuery.refetch();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to add requirement",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error"
      });
    }
  });

  const requestResubmissionMutation = useMutation({
    mutationFn: async ({ note }: { note?: string }) => {
      if (!selectedId || !resubmissionItem) {
        throw new Error("No requirement selected");
      }
      const payload = note ? { note } : {};
      await api.post(
        `/provider-applications/${selectedId}/items/${resubmissionItem.id}/request-resubmission`,
        payload
      );
    },
    onSuccess: () => {
      toast.showToast({
        title: "Resubmission requested",
        description: "The provider has been notified to update this requirement.",
        variant: "info"
      });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications", selectedId, "detail"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications"] });
      }
      closeResubmission();
    },
    onError: (error: unknown) => {
      setResubmissionError(error instanceof Error ? error.message : "Unable to request resubmission");
    }
  });

  const metrics = useMemo(() => {
    const summary = {
      total: applications.length,
      awaitingReview: 0,
      inProgress: 0,
      approved: 0,
      rejected: 0
    };
    applications.forEach((application) => {
      switch (application.status) {
        case "submitted":
          summary.awaitingReview += 1;
          break;
        case "under_review":
          summary.inProgress += 1;
          break;
        case "approved":
          summary.approved += 1;
          break;
        case "rejected":
          summary.rejected += 1;
          break;
        default:
          break;
      }
    });
    return summary;
  }, [applications]);

  const metricTiles = useMemo(
    () => [
      { label: "Total in view", value: metrics.total, tone: "text-slate-900" },
      { label: "Awaiting review", value: metrics.awaitingReview, tone: "text-amber-600" },
      { label: "In progress", value: metrics.inProgress, tone: "text-primary-600" },
      { label: "Approved", value: metrics.approved, tone: "text-emerald-600" },
      { label: "Rejected", value: metrics.rejected, tone: "text-rose-600" }
    ],
    [metrics]
  );

  const applicationCards = useMemo(() => {
    return applications
      .slice()
      .sort((a, b) => {
        const aTime = a.submitted_at ? new Date(a.submitted_at).valueOf() : 0;
        const bTime = b.submitted_at ? new Date(b.submitted_at).valueOf() : 0;
        return bTime - aTime;
      })
      .map((application) => {
        const submittedAt = application.submitted_at ? dateTime.format(new Date(application.submitted_at)) : null;
        const reviewedAt = application.reviewed_at ? dateTime.format(new Date(application.reviewed_at)) : null;
        const applicantName = application.user?.full_name || application.user?.email || "Unknown applicant";
        const requirementTotals = application.items?.reduce(
          (acc, item) => {
            acc.total += 1;
            if (item.status === "verified") {
              acc.verified += 1;
            } else if (item.status === "pending") {
              acc.pending += 1;
            } else if (item.status === "rejected") {
              acc.flagged += 1;
            }
            return acc;
          },
          { total: 0, verified: 0, pending: 0, flagged: 0 }
        ) ?? { total: 0, verified: 0, pending: 0, flagged: 0 };

        return {
          id: application.id,
          applicantName,
          status: application.status,
          submittedAt,
          reviewedAt,
          requirementTotals
        };
      });
  }, [applications]);

  const availableRequirements = useMemo(() => {
    if (!requirementsQuery.data) {
      return [] as RequirementType[];
    }
    const existing = new Set(
      (detail?.items ?? [])
        .map((item) => item.requirement_type?.id)
        .filter((id): id is string => Boolean(id))
    );
    return requirementsQuery.data.filter((requirement) => requirement.is_active && !existing.has(requirement.id));
  }, [requirementsQuery.data, detail?.items]);

  const handleReview = (decision: "approved" | "rejected", id?: string) => {
    const targetId = id ?? selectedId;
    if (!targetId) {
      return;
    }
    reviewMutation.mutate({ id: targetId, decision });
  };

  const handleFilterToggle = () => {
    if (!filtersOpen) {
      setDraftStatusFilter(statusFilter);
      setDraftSearchTerm(searchTerm);
    }
    setFiltersOpen((prev) => !prev);
  };

  const applyFilterChanges = () => {
    setStatusFilter(draftStatusFilter);
    setSearchTerm(draftSearchTerm.trim());
    setFiltersOpen(false);
  };

  const clearFilterChanges = () => {
    setDraftStatusFilter("all");
    setDraftSearchTerm("");
    setStatusFilter("all");
    setSearchTerm("");
    setFiltersOpen(false);
  };

  const hasActiveFilters = statusFilter !== "all" || Boolean(searchTerm);
  const statusFilterLabel =
    statusFilter === "all"
      ? "All statuses"
      : STATUSES.find((option) => option.value === statusFilter)?.label ?? "Custom";

  const filteredApplicationCards = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return applicationCards;
    }
    return applicationCards.filter((card) => {
      const haystack = `${card.applicantName} ${card.status}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [applicationCards, searchTerm]);

  const filterPanel = (
    <div className="space-y-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          value={draftStatusFilter}
          onChange={(event) => setDraftStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          <option value="all">All</option>
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Search applicants"
        placeholder="Name or email"
        value={draftSearchTerm}
        onChange={(event) => setDraftSearchTerm(event.target.value)}
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

  const statusBadgeClass = (status: string) =>
    classNames(
      "rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide",
      status === "approved"
        ? "bg-emerald-100 text-emerald-700"
        : status === "rejected"
        ? "bg-rose-100 text-rose-700"
        : status === "under_review"
        ? "bg-amber-100 text-amber-700"
        : status === "draft"
        ? "bg-slate-200 text-slate-600"
        : "bg-slate-100 text-slate-600"
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Provider workspace</h1>
          <p className="text-sm text-slate-500">Manage onboarding queues, review submissions, and tune requirements in one place.</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600 shadow-sm">
          {(["applications", "requirements"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={classNames(
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                activeTab === tab
                  ? "border-primary-200 bg-primary-50 text-primary-800 shadow-inner"
                  : "border-transparent text-slate-600 hover:text-primary-600"
              )}
              aria-pressed={activeTab === tab}
            >
              {tab === "applications" ? "Applications" : "Requirements"}
            </button>
          ))}
        </div>
      </div>
      {activeTab === "applications" ? (
        <>
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {metricTiles.map((tile) => (
                <div key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{tile.label}</p>
                  <p className={`mt-1 text-2xl font-semibold ${tile.tone}`}>{tile.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div ref={filterMenuRef} className="relative inline-flex">
                <Button
                  variant={hasActiveFilters ? "primary" : "secondary"}
                  onClick={handleFilterToggle}
                  className="inline-flex items-center gap-2"
                >
                  Filters
                  {hasActiveFilters && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                      Active
                    </span>
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
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-200 px-3 py-1">Status: {statusFilterLabel}</span>
                {searchTerm && (
                  <span className="rounded-full bg-slate-200 px-3 py-1">
                    Search: &ldquo;{searchTerm.length > 24 ? `${searchTerm.slice(0, 24)}…` : searchTerm}&rdquo;
                  </span>
                )}
                {!hasActiveFilters && <span className="text-slate-400">Showing all applications</span>}
              </div>
            </div>
          </section>

      <Card title="Applications" padding="none">
        {isLoading && !applications.length ? (
          <div className="flex h-40 items-center justify-center">
            <Loading />
          </div>
        ) : filteredApplicationCards.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">No applications match the selected filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Applicant</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Checklist</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Timeline</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredApplicationCards.map((card) => {
                    const canDecide = card.status === "submitted" || card.status === "under_review";
                    return (
                      <tr key={card.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-slate-900">{card.applicantName}</p>
                          {card.submittedAt && (
                            <p className="text-xs text-slate-500">Submitted {card.submittedAt}</p>
                          )}
                          {card.reviewedAt && (
                            <p className="text-xs text-slate-400">Reviewed {card.reviewedAt}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">
                            {card.requirementTotals.verified}/{card.requirementTotals.total} verified
                          </p>
                          <p className="text-xs text-amber-600">{card.requirementTotals.pending} pending</p>
                          <p className="text-xs text-rose-600">{card.requirementTotals.flagged} flagged</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={statusBadgeClass(card.status)}>{card.status}</span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {card.reviewedAt ? (
                            <>
                              <div className="font-semibold text-slate-700">Reviewed</div>
                              <div>{card.reviewedAt}</div>
                            </>
                          ) : card.submittedAt ? (
                            <>
                              <div className="font-semibold text-slate-700">Submitted</div>
                              <div>{card.submittedAt}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className="px-3 py-1 text-xs"
                              onClick={() => navigate(`/admin/providers/applications/${card.id}`)}
                            >
                              Review
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1 text-xs"
                              onClick={() => setSelectedId(card.id)}
                            >
                              Quick actions
                            </Button>
                            {canDecide && (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="px-3 py-1 text-xs text-rose-600"
                                  disabled={reviewMutation.isLoading}
                                  onClick={() => setConfirmState({ action: "rejected", id: card.id })}
                                >
                                  Reject
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="px-3 py-1 text-xs text-emerald-600"
                                  disabled={reviewMutation.isLoading}
                                  onClick={() => setConfirmState({ action: "approved", id: card.id })}
                                >
                                  Approve
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isFetchingNextPage && (
              <div className="flex items-center justify-center border-t border-slate-200 px-6 py-4">
                <Loading label="Loading more applications…" />
              </div>
            )}
          </>
        )}
        {hasNextPage && (
          <div className="flex flex-col items-center gap-3 border-t border-slate-200 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
              disabled={isFetchingNextPage}
            >
              Load more
            </Button>
            <div ref={loadMoreRef} className="h-4 w-full" aria-hidden />
          </div>
        )}
      </Card>

      <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Review application">
        {detailLoading || !detail ? (
          <Loading />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Applicant</p>
              <p className="text-sm text-slate-600">
                {detail.user?.full_name || detail.user?.email || "Unknown applicant"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">Requirements</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={openAddRequirement}
                  disabled={availableRequirements.length === 0 || addRequirementMutation.isLoading}
                >
                  Add requirement
                </Button>
              </div>
              <ul className="mt-3 space-y-3">
                {detail.items?.map((item) => {
                  const label = item.requirement_type?.label ?? "Requirement";
                  const input = item.requirement_type?.input_type ?? "";
                  const statusClasses = classNames(
                    "rounded-full px-2 py-1 text-xs font-semibold uppercase",
                    item.status === "verified"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.status === "rejected"
                      ? "bg-rose-100 text-rose-700"
                      : item.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-200 text-slate-600"
                  );
                  return (
                    <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800">{label}</p>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs uppercase tracking-wide text-slate-500">
                              {input}
                            </span>
                          </div>
                          {item.value_text && (
                            <p className="mt-2 break-words text-sm text-slate-600">{item.value_text}</p>
                          )}
                          {item.download_url || item.file_url ? (
                            <a
                              href={item.download_url || item.file_url || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                              View submitted link
                            </a>
                          ) : null}
                          {item.comment && (
                            <p className="mt-2 text-xs text-slate-500">Reviewer note: {item.comment}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={statusClasses}>{item.status}</span>
                          {item.status !== "verified" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openResubmission(item)}
                              disabled={requestResubmissionMutation.isLoading}
                            >
                              Request resubmission
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {detail.items?.length === 0 && (
                  <li className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    No requirements attached yet.
                  </li>
                )}
              </ul>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={reviewMutation.isLoading}
                onClick={() => detail?.id && setConfirmState({ action: "rejected", id: detail.id })}
              >
                Reject
              </Button>
              <Button
                disabled={reviewMutation.isLoading}
                onClick={() => detail?.id && setConfirmState({ action: "approved", id: detail.id })}
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={addRequirementOpen} onClose={closeAddRequirement} title="Add requirement">
        {requirementsQuery.isLoading ? (
          <Loading />
        ) : availableRequirements.length === 0 ? (
          <p className="text-sm text-slate-600">All requirements are already attached to this application.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Select an additional requirement to include in this provider's checklist.</p>
            <select
              value={selectedRequirementId}
              onChange={(event) => setSelectedRequirementId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="">Select a requirement</option>
              {availableRequirements.map((requirement) => (
                <option key={requirement.id} value={requirement.id}>
                  {requirement.label}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeAddRequirement} disabled={addRequirementMutation.isLoading}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedRequirementId && addRequirementMutation.mutate(selectedRequirementId)}
                disabled={!selectedRequirementId}
                loading={addRequirementMutation.isLoading}
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(resubmissionItem)} onClose={closeResubmission} title="Request resubmission">
        {resubmissionItem ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">{resubmissionItem.requirement_type?.label}</p>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {resubmissionItem.requirement_type?.input_type}
              </p>
            </div>
            <label className="text-sm text-slate-600" htmlFor="resubmission-note">
              Message to provider (optional)
              <textarea
                id="resubmission-note"
                rows={4}
                value={resubmissionNote}
                onChange={(event) => setResubmissionNote(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </label>
            {resubmissionError && <p className="text-xs text-rose-600">{resubmissionError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={closeResubmission}
                disabled={requestResubmissionMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  requestResubmissionMutation.mutate({
                    note: resubmissionNote.trim() ? resubmissionNote.trim() : undefined
                  })
                }
                loading={requestResubmissionMutation.isLoading}
              >
                Send request
              </Button>
            </div>
          </div>
        ) : (
          <Loading />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.action === "approved" ? "Approve application?" : "Reject application?"}
        description={
          confirmState?.action === "approved"
            ? "The provider will be verified immediately and notified of the decision."
            : "The provider will be notified that more work is required before they can be verified."
        }
        confirmLabel={confirmState?.action === "approved" ? "Approve" : "Reject"}
        confirmVariant={confirmState?.action === "approved" ? "primary" : "secondary"}
        loading={reviewMutation.isLoading}
        onConfirm={() => confirmState && handleReview(confirmState.action, confirmState.id)}
        onClose={() => {
          if (!reviewMutation.isLoading) {
            setConfirmState(null);
          }
        }}
      />
        </>
      ) : (
        <ProviderRequirementsPanel />
      )}
    </div>
  );
};

export default ProviderApplicationsPage;
