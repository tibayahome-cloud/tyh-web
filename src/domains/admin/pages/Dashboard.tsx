import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Card } from "../../../shared/components/Card";
import { DataGrid } from "../../../shared/components/DataGrid";
import { Loading } from "../../../shared/components/Loading";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import { api } from "../../../shared/libs/api";
import { Can } from "../../../shared/rbac/Can";
import { PERMISSION_ADMIN_ACCESS } from "../../../shared/rbac/roles";
import { MetricCard } from "../components/MetricCard";

type AdminMetrics = {
  generated_at: string;
  users: {
    total: number;
    active: number;
    pending: number;
  };
  providers: {
    total: number;
    verified: number;
    available: number;
  };
  services: {
    total: number;
    active: number;
    emergency_capable: number;
  };
  applications: {
    pending: number;
    approved_today: number;
    avg_review_minutes: number | null;
  };
};

type Envelope<T, M = Record<string, unknown>> = {
  data: T;
  meta?: M;
};

type ProviderLeaderboardRaw = {
  provider_id: string;
  user_id: string;
  rank: number;
  rating_avg: number;
  rating_count: number;
  full_name: string | null;
  avatar_url: string | null;
};

type ProviderLeaderboardMeta = {
  generated_at?: string;
  total_providers?: number;
};

type ProviderLeaderboardItem = {
  providerId: string;
  userId: string;
  rank: number;
  ratingAvg: number;
  ratingCount: number;
  fullName: string | null;
  avatarUrl: string | null;
};

type ProviderLeaderboardResponse = {
  items: ProviderLeaderboardItem[];
  totalProviders: number;
  generatedAt: string;
};

const computeInitials = (value?: string | null) => {
  if (!value) {
    return "--";
  }
  const cleaned = value.trim();
  if (!cleaned) {
    return "--";
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

const resolveAvatarUrl = (avatarUrl: string | null, origin: string): string | null => {
  if (!avatarUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(avatarUrl)) {
    return avatarUrl;
  }
  const prefix = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;
  return `${origin}${prefix}`;
};

const fetchAdminMetrics = async (): Promise<AdminMetrics> => {
  const response = await api.get<Envelope<AdminMetrics>>("/admin/metrics");
  return response.data.data;
};

const fetchProviderLeaderboard = async (): Promise<ProviderLeaderboardResponse> => {
  const response = await api.get<Envelope<ProviderLeaderboardRaw[], ProviderLeaderboardMeta>>(
    "/admin/providers/leaderboard",
    {
      params: {
        limit: 5,
        min_rating_count: 1
      }
    }
  );
  const meta = response.data.meta ?? {};
  const items = (response.data.data ?? []).map<ProviderLeaderboardItem>((entry) => ({
    providerId: entry.provider_id,
    userId: entry.user_id,
    rank: entry.rank,
    ratingAvg: entry.rating_avg,
    ratingCount: entry.rating_count,
    fullName: entry.full_name ?? null,
    avatarUrl: entry.avatar_url ?? null
  }));
  return {
    items,
    totalProviders:
      typeof meta.total_providers === "number"
        ? meta.total_providers
        : items.length,
    generatedAt:
      typeof meta.generated_at === "string"
        ? meta.generated_at
        : new Date().toISOString()
  };
};

const Dashboard = () => {
  const { user, roles, permissions } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();

  const {
    data: metrics,
    isLoading: metricsLoading,
    isFetching: metricsFetching
  } = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: fetchAdminMetrics,
    staleTime: 30_000
  });

  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
    isFetching: leaderboardFetching
  } = useQuery({
    queryKey: ["admin", "provider-leaderboard"],
    queryFn: fetchProviderLeaderboard,
    staleTime: 60_000
  });

  useEffect(() => {
    if (!socket) {
      return;
    }

    const events = [
      "model.provider_application.submitted",
      "model.provider_application.reviewed",
      "model.provider.updated",
      "model.service.created",
      "model.service.updated"
    ];

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-leaderboard"] });
    };

    events.forEach((event) => socket.on(event, invalidate));

    return () => {
      events.forEach((event) => socket.off(event, invalidate));
    };
  }, [socket, queryClient]);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
  const apiOrigin = useMemo(() => {
    try {
      if (apiBase) {
        return new URL(apiBase, typeof window !== "undefined" ? window.location.origin : undefined).origin;
      }
    } catch {
      /* noop */
    }
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "";
  }, [apiBase]);

  const metricCards = useMemo(() => {
    if (!metrics) {
      return [];
    }
    return [
      {
        title: "Total users",
        value: metrics.users.total,
        helper: `${metrics.users.active} active · ${metrics.users.pending} pending`
      },
      {
        title: "Providers",
        value: metrics.providers.total,
        helper: `${metrics.providers.verified} verified · ${metrics.providers.available} available`
      },
      {
        title: "Services",
        value: metrics.services.total,
        helper: `${metrics.services.active} active · ${metrics.services.emergency_capable} emergency`
      },
      {
        title: "Applications pending",
        value: metrics.applications.pending,
        helper:
          metrics.applications.avg_review_minutes != null
            ? `Avg review: ${metrics.applications.avg_review_minutes} min`
            : "Avg review pending"
      }
    ];
  }, [metrics]);

  const leaderboardItems = leaderboard?.items ?? [];
  const leaderboardDescription = useMemo(() => {
    if (!leaderboard?.generatedAt) {
      return "Highest-rated providers across the platform.";
    }
    try {
      const when = new Date(leaderboard.generatedAt);
      return `Highest-rated providers • updated ${when.toLocaleTimeString()}`;
    } catch {
      return "Highest-rated providers across the platform.";
    }
  }, [leaderboard?.generatedAt]);

  const rows = permissions.map((perm, index) => ({
    id: index,
    permission: perm
  }));

  const columns = [
    {
      field: "permission",
      headerName: "Permission",
      flex: 1,
      minWidth: 200
    }
  ];

  return (
    <div className="space-y-6">
      <Card title="Admin dashboard" description={`${metrics?.generated_at ? `Last updated ${new Date(metrics.generated_at).toLocaleTimeString()}` : "Stay on top of platform activity."}`}>
        <p className="text-sm text-slate-600">
          {user?.fullName ? `Hello, ${user.fullName}.` : "Welcome, Admin."}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.length === 0 ? (
          Array.from({ length: 4 }).map((_, index) => (
            <MetricCard key={index} title="" value={0} helper="" loading />
          ))
        ) : (
          metricCards.map((metric, index) => (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              helper={
                index === 3 && metrics?.applications
                  ? `${metric.helper} · ${metrics.applications.approved_today} approved today`
                  : metric.helper
              }
              loading={metricsLoading || metricsFetching}
            />
          ))
        )}
      </div>

      <Card title="Top providers" description={leaderboardDescription}>
        {leaderboardLoading && leaderboardItems.length === 0 ? (
          <Loading />
        ) : leaderboardItems.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {leaderboardItems.map((entry) => {
              const avatarSrc = resolveAvatarUrl(entry.avatarUrl, apiOrigin);
              const initials = computeInitials(entry.fullName ?? entry.userId);
              return (
                <li key={entry.providerId} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700 ring-1 ring-primary-100">
                      {entry.rank}
                    </span>
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={entry.fullName ?? entry.userId}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                        {initials}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.fullName ?? "Unknown provider"}</p>
                      <p className="text-xs text-slate-500">{entry.ratingCount} {entry.ratingCount === 1 ? "review" : "reviews"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">{entry.ratingAvg.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">Average rating</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No providers have been rated yet. Encourage clients to leave feedback.</p>
        )}
        {leaderboardFetching && <p className="mt-3 text-xs text-slate-400">Refreshing leaderboard…</p>}
      </Card>

      <Card title="Roles">
        <p className="text-sm text-slate-600">{roles.length === 0 ? "No roles assigned" : roles.join(", ")}</p>
      </Card>
      <Can perm={PERMISSION_ADMIN_ACCESS} fallback={<Card title="Permissions">Access restricted.</Card>}>
        <Card title="Permissions">
          {permissions.length === 0 ? (
            <p className="text-sm text-slate-600">No administrative permissions granted.</p>
          ) : (
            <DataGrid rows={rows} columns={columns} autoHeight />
          )}
        </Card>
      </Can>
    </div>
  );
};

export default Dashboard;
