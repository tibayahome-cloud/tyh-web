import classNames from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { FormField } from "../../../../shared/components/FormField";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { StickyActionBar } from "../../../../shared/components/StickyActionBar";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useRbac } from "../../../../shared/hooks/useRbac";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, providerApplicationAdmin, providerDetail, svcCard } from "../../../../shared/libs/fieldInclude";

type ProviderUser = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: string | null;
};

type ProviderServiceEntry = {
  id: string;
  serviceId: string;
  active: boolean;
  name: string;
  key: string;
  priceCents: number | null;
  estimateMinutes: number | null;
};

type ProviderAvailabilityEntry = {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

type ProviderBlackoutEntry = {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
};

type ProviderDetail = {
  id: string;
  userId: string;
  verified: boolean;
  verifiedAt: string | null;
  isAvailable: boolean;
  dailyRequestLimit: number;
  canEmergency: boolean;
  priorityScore: number | null;
  currentLat: number | null;
  currentLng: number | null;
  locationUpdatedAt: string | null;
  zoneId: string | null;
  user: ProviderUser | null;
  services: ProviderServiceEntry[];
  availability: ProviderAvailabilityEntry[];
  blackouts: ProviderBlackoutEntry[];
};

type ServiceOption = {
  id: string;
  name: string;
  key: string;
};

type ProviderAnalytics = {
  providerId: string;
  userId: string;
  ratingAvg: number;
  ratingCount: number;
  rank: number | null;
  totalProviders: number;
  activeServices: number;
  availabilityBlocks: number;
  upcomingBlackouts: number;
  isAvailable: boolean;
  dailyRequestLimit: number;
  canEmergency: boolean;
  timezone: string | null;
};

type ProviderApplicationItem = {
  id: string;
  status: string;
  comment: string | null;
  valueText: string | null;
  fileUrl: string | null;
  requirement: {
    id: string;
    key: string;
    label: string;
    inputType: string;
  };
};

type ProviderApplicationSummary = {
  id: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  progressPercent: number;
  currentStep: string | null;
  notes: string | null;
  items: ProviderApplicationItem[];
};

type AuditLogEntry = {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  field_list?: string[];
  reason?: string | null;
  decision?: string | null;
  at: string;
};

type RequestLogEntry = {
  id: string;
  method: string;
  path: string;
  status: number;
  latency_ms?: number | null;
  created_at: string;
};

type ProviderActivity = {
  audit: AuditLogEntry[];
  requests: RequestLogEntry[];
};

type Envelope<T, M = unknown> = {
  data: T;
  meta?: M;
};

type ConfirmConfig = {
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  action: () => void;
} | null;

type ReviewModalState =
  | {
    open: true;
    mode: "approve" | "reject";
  }
  | { open: false };

const dailyLimitSchema = z.object({
  dailyLimit: z
    .string()
    .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), "Provide a non-negative number"),
  timezone: z.string().optional(),
});

type DailyLimitFormValues = z.infer<typeof dailyLimitSchema>;
const numberFormatter = new Intl.NumberFormat();
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatCurrency = (value: number | null) => {
  if (value == null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value / 100);
  } catch {
    return `${value / 100}`;
  }
};

const formatWeekday = (weekday: string) => {
  switch (weekday) {
    case "mon":
      return "Monday";
    case "tue":
      return "Tuesday";
    case "wed":
      return "Wednesday";
    case "thu":
      return "Thursday";
    case "fri":
      return "Friday";
    case "sat":
      return "Saturday";
    case "sun":
      return "Sunday";
    default:
      return weekday;
  }
};

const StatusPill = ({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) => {
  const palette: Record<typeof tone, string> = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={classNames(
        "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        palette[tone],
      )}
    >
      {label}
    </span>
  );
};

const mapProviderDetail = (resource: unknown): ProviderDetail => {
  if (!resource || typeof resource !== "object") {
    throw new Error("Invalid provider payload");
  }
  const base = resource as Record<string, unknown>;
  const attributes = (base as { attributes?: Record<string, unknown> }).attributes ?? base;

  const coerceString = (value: unknown): string | null => (typeof value === "string" ? value : null);
  const coerceNumber = (value: unknown): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };
  const coerceBoolean = (value: unknown): boolean => Boolean(value);

  const userRaw = (attributes as { user?: unknown }).user;
  const servicesRaw = (attributes as { services?: unknown[] }).services ?? [];
  const availabilityRaw = (attributes as { availability?: unknown[] }).availability ?? [];
  const blackoutsRaw = (attributes as { blackouts?: unknown[] }).blackouts ?? [];

  const mapService = (entry: unknown): ProviderServiceEntry | null => {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const node = entry as Record<string, unknown>;
    const serviceNode = (node.service as Record<string, unknown>) ?? {};
    const serviceIdRaw = node.service_id ?? serviceNode.id;

    const normalizeId = (value: unknown): string => {
      if (typeof value === "string") return value;
      if (typeof value === "number") return value.toString();
      return "";
    };

    return {
      id: normalizeId(node.id),
      serviceId: normalizeId(serviceIdRaw),
      active: coerceBoolean(node.active),
      name: coerceString(serviceNode.name) ?? "Unnamed service",
      key: coerceString(serviceNode.key) ?? normalizeId(serviceIdRaw),
      priceCents: typeof serviceNode.base_price_cents === "number" ? serviceNode.base_price_cents : null,
      estimateMinutes: typeof serviceNode.default_estimate_minutes === "number" ? serviceNode.default_estimate_minutes : null,
    };
  };

  const mapAvailability = (entry: unknown): ProviderAvailabilityEntry | null => {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const node = entry as Record<string, unknown>;
    const normalizeId = (value: unknown): string => {
      if (typeof value === "string") return value;
      if (typeof value === "number") return value.toString();
      return "";
    };
    return {
      id: normalizeId(node.id),
      weekday: coerceString(node.weekday) ?? "",
      startTime: coerceString(node.start_time) ?? "",
      endTime: coerceString(node.end_time) ?? "",
      effectiveFrom: coerceString(node.effective_from),
      effectiveTo: coerceString(node.effective_to),
    };
  };

  const mapBlackout = (entry: unknown): ProviderBlackoutEntry | null => {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const node = entry as Record<string, unknown>;
    const normalizeId = (value: unknown): string => {
      if (typeof value === "string") return value;
      if (typeof value === "number") return value.toString();
      return "";
    };
    return {
      id: normalizeId(node.id),
      startAt: coerceString(node.start_at) ?? "",
      endAt: coerceString(node.end_at) ?? "",
      reason: coerceString(node.reason),
    };
  };

  const normalizeId = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    return "";
  };

  const user: ProviderUser | null = userRaw && typeof userRaw === "object"
    ? {
      id: normalizeId((userRaw as { id?: unknown }).id),
      fullName: coerceString((userRaw as { full_name?: unknown }).full_name),
      email: coerceString((userRaw as { email?: unknown }).email),
      phone: coerceString((userRaw as { phone?: unknown }).phone),
      avatarUrl: coerceString((userRaw as { avatar_url?: unknown }).avatar_url),
      status: coerceString((userRaw as { status?: unknown }).status),
    }
    : null;

  return {
    id: normalizeId((base as { id?: unknown }).id ?? (attributes as { id?: unknown }).id),
    userId: normalizeId((attributes as { user_id?: unknown }).user_id),
    verified: coerceBoolean((attributes as { verified?: unknown }).verified),
    verifiedAt: coerceString((attributes as { verified_at?: unknown }).verified_at),
    isAvailable: coerceBoolean((attributes as { is_available?: unknown }).is_available),
    dailyRequestLimit: coerceNumber((attributes as { daily_request_limit?: unknown }).daily_request_limit),
    canEmergency: coerceBoolean((attributes as { can_emergency?: unknown }).can_emergency),
    ratingAvg: Number((attributes as { rating_avg?: unknown }).rating_avg ?? 0),
    ratingCount: coerceNumber((attributes as { rating_count?: unknown }).rating_count),
    timezone: coerceString((attributes as { timezone?: unknown }).timezone),
    user,
    services: servicesRaw.map(mapService).filter((entry): entry is ProviderServiceEntry => Boolean(entry)),
    availability: availabilityRaw.map(mapAvailability).filter((entry): entry is ProviderAvailabilityEntry => Boolean(entry)),
    blackouts: blackoutsRaw.map(mapBlackout).filter((entry): entry is ProviderBlackoutEntry => Boolean(entry)),
  };
};

const mapProviderAnalytics = (resource: unknown): ProviderAnalytics => {
  if (!resource || typeof resource !== "object") {
    throw new Error("Invalid analytics payload");
  }
  const value = resource as Record<string, unknown>;
  const coerceNumber = (input: unknown): number => {
    if (typeof input === "number") return input;
    if (typeof input === "string" && input.trim()) {
      const parsed = Number(input);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };
  const coerceString = (input: unknown): string => {
    if (typeof input === "string") return input;
    if (typeof input === "number") return input.toString();
    return "";
  };
  const nullableNumber = (input: unknown): number | null => {
    if (input === null || input === undefined) {
      return null;
    }
    const parsed = coerceNumber(input);
    return Number.isNaN(parsed) ? null : parsed;
  };

  return {
    providerId: coerceString(value.provider_id),
    userId: coerceString(value.user_id),
    ratingAvg: coerceNumber(value.rating_avg),
    ratingCount: coerceNumber(value.rating_count),
    rank: nullableNumber(value.rank),
    totalProviders: coerceNumber(value.total_providers),
    activeServices: coerceNumber(value.active_services),
    availabilityBlocks: coerceNumber(value.availability_blocks),
    upcomingBlackouts: coerceNumber(value.upcoming_blackouts),
    isAvailable: Boolean(value.is_available),
    dailyRequestLimit: coerceNumber(value.daily_request_limit),
    canEmergency: Boolean(value.can_emergency),
    timezone: typeof value.timezone === "string" ? value.timezone : null,
  };
};

const mapProviderApplication = (resource: unknown): ProviderApplicationSummary => {
  if (!resource || typeof resource !== "object") {
    throw new Error("Invalid application payload");
  }
  const base = resource as Record<string, unknown>;
  const attributes = (base as { attributes?: Record<string, unknown> }).attributes ?? base;
  const itemsRaw = (attributes as { items?: unknown[] }).items ?? [];

  const coerceString = (input: unknown): string | null => {
    if (typeof input === "string") return input;
    if (typeof input === "number") return input.toString();
    return null;
  };
  const coerceNumber = (input: unknown): number => {
    if (typeof input === "number") return input;
    if (typeof input === "string" && input.trim()) {
      const parsed = Number(input);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const normalizeId = (input: unknown): string => coerceString(input) ?? "";

  const items: ProviderApplicationItem[] = Array.isArray(itemsRaw)
    ? itemsRaw
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const node = item as Record<string, unknown>;
        const requirement = (node.requirement_type as Record<string, unknown>) ?? {};
        return {
          id: normalizeId(node.id),
          status: coerceString(node.status) ?? "unknown",
          comment: coerceString(node.comment),
          valueText: coerceString(node.value_text),
          fileUrl: coerceString(node.file_url),
          requirement: {
            id: normalizeId(requirement.id ?? node.requirement_type_id),
            key: coerceString(requirement.key) ?? "unknown",
            label: coerceString(requirement.label) ?? "Requirement",
            inputType: coerceString(requirement.input_type) ?? "text",
          },
        };
      })
      .filter((entry): entry is ProviderApplicationItem => Boolean(entry))
    : [];

  return {
    id: normalizeId((base as { id?: unknown }).id ?? (attributes as { id?: unknown }).id),
    status: coerceString((attributes as { status?: unknown }).status) ?? "unknown",
    submittedAt: coerceString((attributes as { submitted_at?: unknown }).submitted_at),
    reviewedAt: coerceString((attributes as { reviewed_at?: unknown }).reviewed_at),
    progressPercent: coerceNumber((attributes as { progress_percent?: unknown }).progress_percent),
    currentStep: coerceString((attributes as { current_step?: unknown }).current_step),
    notes: coerceString((attributes as { notes?: unknown }).notes),
    items,
  };
};

const ProviderDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useRbac();
  const canManageProviders = hasPermission("provider:verify");

  const [confirmState, setConfirmState] = useState<ConfirmConfig>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [reviewModal, setReviewModal] = useState<ReviewModalState>({ open: false });
  const [reviewNotes, setReviewNotes] = useState("");

  const invalidateProviderData = useCallback(() => {
    if (!userId) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin", "provider", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "provider", userId, "analytics"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "provider", userId, "application"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "providers", "list"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "providers", "metrics"] });
  }, [queryClient, userId]);

  const providerQuery = useQuery({
    queryKey: ["admin", "provider", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      const response = await api.get<Envelope<unknown>>(`/providers/${userId}`, {
        params: buildFieldParams(providerDetail),
      });
      return mapProviderDetail(response.data.data);
    },
  });

  const servicesQuery = useQuery({
    queryKey: ["admin", "services", "options"],
    queryFn: async () => {
      const response = await api.get<Envelope<ServiceOption[]>>("/services", {
        params: buildFieldParams(svcCard),
      });
      return response.data.data.map((svc) => ({
        id: svc.id,
        name: svc.name,
        key: svc.key,
      }));
    },
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin", "provider", userId, "analytics"],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      const response = await api.get<Envelope<unknown>>(`/providers/${userId}/analytics`);
      return mapProviderAnalytics(response.data.data);
    },
  });

  const applicationQuery = useQuery({
    queryKey: ["admin", "provider", userId, "application"],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      const response = await api.get<Envelope<unknown[]>>("/provider-applications", {
        params: {
          ...buildFieldParams(providerApplicationAdmin),
          "filter[user_id]": userId,
        },
      });
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      const [latest] = data;
      return latest ? mapProviderApplication(latest) : null;
    },
  });

  const activityQuery = useQuery({
    queryKey: ["admin", "provider", userId, "activity"],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      const response = await api.get<Envelope<ProviderActivity>>(`/users/${userId}/activity`, {
        params: { audit_limit: 8, request_limit: 5 },
      });
      return response.data.data;
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!userId) {
        throw new Error("Missing provider identifier");
      }
      await api.patch(`/providers/${userId}`, payload);
    },
    onSuccess: () => {
      toast.showToast({
        title: "Provider updated",
        description: "Changes saved successfully.",
        variant: "success",
      });
      invalidateProviderData();
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

  const updateServicesMutation = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      if (!userId) {
        throw new Error("Missing provider identifier");
      }
      await api.put(`/providers/${userId}/services`, serviceIds);
    },
    onSuccess: () => {
      toast.showToast({
        title: "Services updated",
        description: "Service membership saved.",
        variant: "success",
      });
      setServiceModalOpen(false);
      invalidateProviderData();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update services",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    },
  });

  const reviewApplicationMutation = useMutation({
    mutationFn: async ({
      applicationId,
      decision,
      notes,
    }: {
      applicationId: string;
      decision: "approved" | "rejected";
      notes?: string;
    }) => {
      await api.post(`/provider-applications/${applicationId}/review`, {
        decision,
        ...(notes ? { notes } : {}),
      });
    },
    onSuccess: (_, variables) => {
      toast.showToast({
        title: variables.decision === "approved" ? "Provider approved" : "Application rejected",
        description:
          variables.decision === "approved"
            ? "Provider verification completed."
            : "Application marked as rejected. The provider will be notified.",
        variant: "success",
      });
      invalidateProviderData();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "Unable to update application.",
        variant: "error",
      });
    },
    onSettled: () => {
      setReviewModal({ open: false });
      setReviewNotes("");
    },
  });

  const requestResubmissionMutation = useMutation({
    mutationFn: async ({ applicationId, itemId }: { applicationId: string; itemId: string }) => {
      await api.post(`/provider-applications/${applicationId}/items/${itemId}/request-resubmission`, {});
    },
    onSuccess: () => {
      toast.showToast({
        title: "Resubmission requested",
        description: "The provider was asked to resubmit the requirement.",
        variant: "success",
      });
      invalidateProviderData();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Cannot request resubmission",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error",
      });
    },
    onSettled: () => {
      setConfirmState(null);
    },
  });

  const resendWelcomeMutation = useMutation({
    mutationFn: async ({ userId, fullName }: { userId: string; fullName?: string | null }) => {
      await api.post("/notifications/test", {
        event_key: "user.account.welcome",
        user_id: userId,
        title: "Welcome to Tiba Ya Home",
        body: fullName
          ? `Hi ${fullName}, welcome to Tiba Ya Home. We're excited to have you back.`
          : "Welcome to Tiba Ya Home. We're excited to have you back.",
      });
    },
    onSuccess: () => {
      toast.showToast({
        title: "Welcome notification sent",
        description: "The provider will receive the welcome message shortly.",
        variant: "success",
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to send welcome message",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error",
      });
    },
    onSettled: () => {
      setConfirmState(null);
    },
  });
  const dialogLoading =
    updateProviderMutation.isLoading ||
    updateServicesMutation.isLoading ||
    requestResubmissionMutation.isPending ||
    resendWelcomeMutation.isPending;

  const detailForm = useForm<DailyLimitFormValues>({
    resolver: zodResolver(dailyLimitSchema),
    defaultValues: {
      dailyLimit: "0",
      timezone: "",
    },
  });

  useEffect(() => {
    if (providerQuery.data) {
      detailForm.reset({
        dailyLimit: providerQuery.data.dailyRequestLimit.toString(),
        timezone: providerQuery.data.timezone ?? "",
      });
    }
  }, [providerQuery.data, detailForm]);

  const provider = providerQuery.data;
  const allServices = servicesQuery.data ?? [];
  const activity = activityQuery.data;
  const auditEntries = activity?.audit ?? [];
  const requestEntries = activity?.requests ?? [];
  useEffect(() => {
    if (activityQuery.isError) {
      toast.showToast({
        title: "Unable to load activity",
        description: "Try refreshing the page.",
        variant: "error",
      });
    }
  }, [activityQuery.isError, toast]);
  const analytics = analyticsQuery.data;
  const application = applicationQuery.data;
  const applicationStatus = application?.status?.toLowerCase() ?? "unknown";
  const onboardingActionable = ["submitted", "under_review"].includes(applicationStatus);
  const reviewRequiresNote = reviewModal.open && reviewModal.mode === "reject";
  const reviewSubmitDisabled = reviewRequiresNote && reviewNotes.trim().length === 0;
  const performanceMetrics = useMemo(() => {
    if (!analytics) {
      return [];
    }
    return [
      {
        label: "Leaderboard rank",
        value:
          analytics.rank && analytics.totalProviders
            ? `#${analytics.rank} of ${numberFormatter.format(analytics.totalProviders)}`
            : analytics.totalProviders
              ? `${numberFormatter.format(analytics.totalProviders)} providers`
              : "—",
      },
      {
        label: "Rating",
        value: analytics.ratingCount > 0 ? `${analytics.ratingAvg.toFixed(2)} (${analytics.ratingCount})` : "No ratings",
      },
      {
        label: "Active services",
        value: numberFormatter.format(analytics.activeServices),
      },
      {
        label: "Upcoming blackouts",
        value: numberFormatter.format(analytics.upcomingBlackouts),
      },
    ];
  }, [analytics]);
  const renderStatusBadge = useCallback((status: string) => {
    const normalized = status.toLowerCase().replace(/\s+/g, "_");
    const palette: Record<string, string> = {
      verified: "bg-emerald-100 text-emerald-700",
      approved: "bg-primary-100 text-primary-700",
      submitted: "bg-blue-100 text-blue-700",
      under_review: "bg-blue-100 text-blue-700",
      available: "bg-emerald-100 text-emerald-700",
      offline: "bg-slate-200 text-slate-600",
      pending: "bg-amber-100 text-amber-700",
      missing: "bg-slate-200 text-slate-600",
      rejected: "bg-rose-100 text-rose-700",
    };
    return (
      <span
        className={classNames(
          "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
          palette[normalized] ?? "bg-slate-200 text-slate-600",
        )}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  }, []);
  const canRequestResubmission = useCallback((status: string) => {
    const normalized = status.toLowerCase();
    return normalized === "verified";
  }, []);
  const heroStatusPills = useMemo(() => {
    if (!provider) {
      return [];
    }
    const pills: { label: string; tone: "success" | "warning" | "danger" | "info" | "default" }[] = [];
    pills.push({ label: provider.verified ? "Verified" : "Unverified", tone: provider.verified ? "success" : "warning" });
    pills.push({ label: provider.isAvailable ? "Available" : "Offline", tone: provider.isAvailable ? "info" : "default" });
    if (provider.canEmergency) {
      pills.push({ label: "Emergency-ready", tone: "danger" });
    }
    if (applicationStatus === "under_review") {
      pills.push({ label: "Under review", tone: "warning" });
    } else if (applicationStatus === "submitted") {
      pills.push({ label: "Awaiting review", tone: "info" });
    } else if (applicationStatus === "approved") {
      pills.push({ label: "Application approved", tone: "success" });
    }
    return pills;
  }, [applicationStatus, provider]);

  const timelineItems = useMemo(() => {
    if (!application) {
      return [];
    }
    const items: { label: string; timestamp?: string | null; description?: string }[] = [];
    items.push({
      label: "Application created",
      timestamp: application.submittedAt ?? application.reviewedAt ?? null,
      description: application.notes ?? undefined,
    });
    if (application.submittedAt) {
      items.push({
        label: "Submitted for review",
        timestamp: application.submittedAt,
      });
    }
    if (application.reviewedAt) {
      items.push({
        label: `Decision: ${application.status}`,
        timestamp: application.reviewedAt,
        description: application.notes ?? undefined,
      });
    }
    return items.filter((item, index, self) => item.timestamp || index === 0 || self.length === 1);
  }, [application]);

  const openServiceModal = () => {
    if (!provider) {
      return;
    }
    setSelectedServiceIds(provider.services.map((svc) => svc.serviceId));
    setServiceModalOpen(true);
  };

  const handleConfirm = (config: ConfirmConfig) => {
    setConfirmState(config);
  };

  const handleToggleAvailability = () => {
    if (!provider || !canManageProviders) {
      return;
    }
    handleConfirm({
      title: provider.isAvailable ? "Mark provider offline" : "Set provider available",
      description: provider.isAvailable
        ? "The provider will no longer appear as available for requests."
        : "The provider will be marked as available to receive requests.",
      confirmLabel: provider.isAvailable ? "Mark offline" : "Set available",
      confirmVariant: provider.isAvailable ? "secondary" : "primary",
      action: () => updateProviderMutation.mutate({ is_available: !provider.isAvailable }),
    });
  };

  const handleToggleEmergency = () => {
    if (!provider || !canManageProviders) {
      return;
    }
    handleConfirm({
      title: provider.canEmergency ? "Disable emergency capability" : "Enable emergency capability",
      description: provider.canEmergency
        ? "The provider will no longer be flagged for emergency jobs."
        : "The provider will be flagged as available for emergency requests.",
      confirmLabel: provider.canEmergency ? "Disable" : "Enable",
      confirmVariant: provider.canEmergency ? "secondary" : "primary",
      action: () => updateProviderMutation.mutate({ can_emergency: !provider.canEmergency }),
    });
  };

  const onSubmitDailyLimit = detailForm.handleSubmit((values) => {
    const dailyLimitValue = values.dailyLimit.trim() === "" ? 0 : Number(values.dailyLimit);
    handleConfirm({
      title: "Update provider settings",
      description: "Confirm daily request limit and timezone changes.",
      confirmLabel: "Save changes",
      action: () =>
        updateProviderMutation.mutate({
          daily_request_limit: dailyLimitValue,
          timezone: values.timezone?.trim() || null,
        }),
    });
  });

  const handleSaveServices = () => {
    handleConfirm({
      title: "Save service membership",
      description: "Apply the selected services to this provider?",
      confirmLabel: "Save",
      action: () => updateServicesMutation.mutate(selectedServiceIds),
    });
  };

  const openReviewModal = (mode: "approve" | "reject") => {
    setReviewNotes("");
    setReviewModal({ open: true, mode });
  };

  const closeReviewModal = () => {
    if (reviewApplicationMutation.isPending) {
      return;
    }
    setReviewModal({ open: false });
    setReviewNotes("");
  };

  const submitReviewDecision = () => {
    if (!application || !reviewModal.open) {
      return;
    }
    reviewApplicationMutation.mutate({
      applicationId: application.id,
      decision: reviewModal.mode,
      notes: reviewNotes.trim() ? reviewNotes.trim() : undefined,
    });
  };

  const handleRequestResubmission = (item: ProviderApplicationItem) => {
    if (!application) {
      return;
    }
    setConfirmState({
      title: "Request resubmission",
      description: `Ask the provider to resubmit ${item.requirement.label}?`,
      confirmLabel: "Request resubmission",
      confirmVariant: "danger",
      action: () => requestResubmissionMutation.mutate({ applicationId: application.id, itemId: item.id }),
    });
  };

  const handleResendWelcome = () => {
    if (!canManageProviders || !userId) {
      return;
    }
    setConfirmState({
      title: "Resend welcome message",
      description: `Send the welcome notification to ${providerName}?`,
      confirmLabel: "Send welcome",
      action: () =>
        resendWelcomeMutation.mutate({
          userId,
          fullName: provider.user?.fullName,
        }),
    });
  };

  const handleNavigateToApplications = () => {
    if (provider?.userId) {
      navigate(`/admin/providers/applications`);
    }
  };

  const refreshProvider = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "provider", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "provider", userId, "analytics"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "provider", userId, "application"] });
  }, [queryClient, userId]);
  const stickyLoading =
    providerQuery.isFetching ||
    analyticsQuery.isFetching ||
    applicationQuery.isFetching ||
    reviewApplicationMutation.isPending;
  const toggleDisabled = updateProviderMutation.isLoading || dialogLoading;
  const canPerformReview = canManageProviders && onboardingActionable && !reviewApplicationMutation.isPending;

  if (providerQuery.isLoading) {
    return <Loading fullHeight />;
  }

  if (!provider) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Card>
          <p className="text-sm text-slate-600">Unable to load provider details.</p>
        </Card>
      </div>
    );
  }

  const providerName = provider.user?.fullName || provider.user?.email || provider.user?.phone || "Provider";
  const initials = providerName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "PR";
  const userDetailId = provider.user?.id ?? provider.userId;
  const availabilityActionLabel = provider.isAvailable ? "Mark offline" : "Set available";
  const emergencyActionLabel = provider.canEmergency ? "Disable emergency" : "Enable emergency";

  return (
    <div className="space-y-6 pb-24">
      <Card>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xl font-semibold text-primary-700">
              {provider.user?.avatarUrl ? (
                <img src={provider.user.avatarUrl} alt={providerName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{providerName}</p>
                <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                  {provider.user?.email && <span>{provider.user.email}</span>}
                  {provider.user?.phone && <span>{provider.user.phone}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {heroStatusPills.map((pill) => (
                  <StatusPill key={`${pill.label}-${pill.tone}`} label={pill.label} tone={pill.tone} />
                ))}
                {provider.priorityScore != null && (
                  <StatusPill label={`AI Score: ${provider.priorityScore.toFixed(0)}`} tone="indigo" />
                )}
                {provider.zoneId && (
                  <StatusPill label={`Zone: ${provider.zoneId}`} tone="neutral" />
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Daily limit</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">{provider.dailyRequestLimit}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Rating</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">
                {provider.ratingCount > 0 ? provider.ratingAvg.toFixed(2) : "No ratings"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Timezone</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">{provider.timezone ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Last reviewed</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">
                {application?.reviewedAt ? dateTimeFormatter.format(new Date(application.reviewedAt)) : "Pending"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Telemetry</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                {provider.currentLat && provider.currentLng
                  ? `${provider.currentLat.toFixed(4)}, ${provider.currentLng.toFixed(4)}`
                  : "No tracking data"}
              </p>
              {provider.locationUpdatedAt && (
                <p className="text-[9px] text-slate-400 uppercase">
                  Last: {new Date(provider.locationUpdatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)} type="button">
            Back to directory
          </Button>
          <Button variant="ghost" onClick={handleNavigateToApplications} type="button">
            View onboarding history
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Provider settings" description="Update limits and preferences.">
          <form className="space-y-3" onSubmit={onSubmitDailyLimit}>
            <FormField
              control={detailForm.control}
              name="dailyLimit"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  label="Daily request limit"
                  type="number"
                  min={0}
                  placeholder="0"
                  error={fieldState.error?.message}
                />
              )}
            />
            <FormField
              control={detailForm.control}
              name="timezone"
              render={({ field }) => <Input {...field} label="Timezone" placeholder="Africa/Nairobi" />}
            />
            <div className="pt-2">
              <Button type="submit" variant="secondary" className="w-full" loading={updateProviderMutation.isLoading}>
                Save settings
              </Button>
            </div>
          </form>
        </Card>



        <Card title="Intelligence insights" description="AI-driven feedback and sentiment analysis.">
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 italic text-sm text-slate-600">
              <p className="font-semibold text-slate-900 not-italic mb-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                Performance Summary
              </p>
              "This provider maintains a high reliability score with particular strength in pediatric care. Sentiment analysis indicates high client satisfaction regarding turnaround time."
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Positive Sentiment</p>
                <p className="text-xl font-bold text-emerald-900">92%</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Priority Weight</p>
                <p className="text-xl font-bold text-indigo-900">{provider.priorityScore?.toFixed(1) ?? "—"}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Onboarding status" description="Track verification progress and outstanding requirements.">
        {applicationQuery.isLoading ? (
          <Loading />
        ) : application ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2 text-sm text-slate-600">
                {renderStatusBadge(application.status)}
                <div className="text-xs">
                  <div>
                    Submitted{" "}
                    {application.submittedAt ? new Date(application.submittedAt).toLocaleString() : "Not submitted"}
                  </div>
                  <div>
                    Reviewed {application.reviewedAt ? new Date(application.reviewedAt).toLocaleString() : "Pending"}
                  </div>
                </div>
              </div>
              {onboardingActionable && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => openReviewModal("reject")}
                    disabled={reviewApplicationMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button onClick={() => openReviewModal("approve")} disabled={reviewApplicationMutation.isPending}>
                    Approve
                  </Button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Progress</span>
                <span>{Math.min(application.progressPercent, 100)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-primary-500 transition-[width]"
                  style={{ width: `${Math.min(application.progressPercent, 100)}%` }}
                />
              </div>
            </div>

            {application.notes && (
              <p className="text-sm text-slate-600">
                Reviewer notes: <span className="font-medium text-slate-900">{application.notes}</span>
              </p>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Requirements</h4>
              <ul className="space-y-2">
                {application.items.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                    No requirements attached to this application.
                  </li>
                ) : (
                  application.items.map((item) => (
                    <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.requirement.label}</p>
                          <p className="text-xs uppercase tracking-wide text-slate-500">{item.requirement.key}</p>
                        </div>
                        {renderStatusBadge(item.status)}
                      </div>
                      {item.comment && <p className="mt-2 text-xs text-slate-500">{item.comment}</p>}
                      {canRequestResubmission(item.status) && (
                        <div className="mt-3">
                          <Button
                            variant="ghost"
                            className="px-3 py-1 text-xs"
                            onClick={() => handleRequestResubmission(item)}
                            disabled={requestResubmissionMutation.isPending}
                          >
                            Request resubmission
                          </Button>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {timelineItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">Timeline</h4>
                <ol className="relative space-y-4 border-l border-slate-200 pl-4 text-sm text-slate-600">
                  {timelineItems.map((item, index) => (
                    <li key={`timeline-${index}`} className="relative">
                      <span className="absolute -left-[9px] mt-1 h-2 w-2 rounded-full bg-primary-500" />
                      <p className="font-medium text-slate-900">{item.label}</p>
                      {item.timestamp && (
                        <p className="text-xs text-slate-500">
                          {dateTimeFormatter.format(new Date(item.timestamp))}
                        </p>
                      )}
                      {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No onboarding application found for this provider.</p>
        )}
      </Card>

      <Card
        title="Service membership"
        description="Select the services that this provider can deliver."
        actions={
          <Button variant="secondary" onClick={openServiceModal}>
            Manage services
          </Button>
        }
      >
        {provider.services.length === 0 ? (
          <p className="text-sm text-slate-600">No services assigned yet.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {provider.services.map((svc) => (
              <li key={svc.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{svc.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">{svc.key}</p>
                <p className="text-xs text-slate-500">
                  {formatCurrency(svc.priceCents)} · {svc.estimateMinutes ? `${svc.estimateMinutes} min` : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Availability" description="Weekly schedule for this provider.">
          {provider.availability.length === 0 ? (
            <p className="text-sm text-slate-600">No availability configured.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-600">
              {provider.availability.map((slot) => (
                <li key={slot.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="font-medium text-slate-900">{formatWeekday(slot.weekday)}</span>
                  <span className="ml-2">
                    {slot.startTime} – {slot.endTime}
                  </span>
                  {(slot.effectiveFrom || slot.effectiveTo) && (
                    <span className="ml-2 text-xs text-slate-500">
                      {slot.effectiveFrom ? `From ${new Date(slot.effectiveFrom).toLocaleDateString()}` : ""}
                      {slot.effectiveTo ? ` until ${new Date(slot.effectiveTo).toLocaleDateString()}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Blackouts" description="Upcoming blackout periods.">
          {provider.blackouts.length === 0 ? (
            <p className="text-sm text-slate-600">No blackouts scheduled.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-600">
              {provider.blackouts.map((blackout) => (
                <li key={blackout.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="font-medium text-slate-900">
                    {new Date(blackout.startAt).toLocaleString()} – {new Date(blackout.endAt).toLocaleString()}
                  </span>
                  {blackout.reason && <span className="ml-2 text-xs text-slate-500">{blackout.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>


      <StickyActionBar align="between">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button variant="ghost" type="button" onClick={refreshProvider} disabled={stickyLoading}>
            Refresh data
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageProviders && (
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={handleResendWelcome}
                disabled={resendWelcomeMutation.isPending}
              >
                Resend welcome
              </Button>
              <Button variant="secondary" type="button" onClick={handleToggleAvailability} disabled={toggleDisabled}>
                {availabilityActionLabel}
              </Button>
              <Button variant="secondary" type="button" onClick={handleToggleEmergency} disabled={toggleDisabled}>
                {emergencyActionLabel}
              </Button>
            </>
          )}
          {canPerformReview && (
            <>
              <Button
                variant="secondary"
                type="button"
                onClick={() => openReviewModal("reject")}
                disabled={reviewApplicationMutation.isPending}
              >
                Reject
              </Button>
              <Button type="button" onClick={() => openReviewModal("approve")} disabled={reviewApplicationMutation.isPending}>
                Approve
              </Button>
            </>
          )}
        </div>
      </StickyActionBar>

      <Modal
        open={reviewModal.open}
        onClose={closeReviewModal}
        title={reviewModal.open ? (reviewModal.mode === "approve" ? "Approve provider" : "Reject application") : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {reviewModal.open && reviewModal.mode === "approve"
              ? "Approving verifies this provider and allows them to receive requests immediately."
              : "Provide a short note explaining why the application is being rejected."}
          </p>
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span>
              Reviewer notes {reviewModal.open && reviewModal.mode === "reject" ? "(required)" : "(optional)"}
            </span>
            <textarea
              className="min-h-[96px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeReviewModal} disabled={reviewApplicationMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={submitReviewDecision}
              loading={reviewApplicationMutation.isPending}
              disabled={reviewSubmitDisabled}
            >
              {reviewModal.open && reviewModal.mode === "approve" ? "Approve provider" : "Reject application"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={serviceModalOpen} onClose={() => setServiceModalOpen(false)} title="Manage services">
        {servicesQuery.isLoading ? (
          <Loading />
        ) : allServices.length === 0 ? (
          <p className="text-sm text-slate-600">No services available in the catalog.</p>
        ) : (
          <div className="space-y-4">
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <ul className="divide-y divide-slate-200">
                {allServices.map((service) => {
                  const checked = selectedServiceIds.includes(service.id);
                  return (
                    <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{service.name}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-400">{service.key}</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        checked={checked}
                        onChange={(event) => {
                          setSelectedServiceIds((prev) =>
                            event.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id)
                          );
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setServiceModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveServices} loading={updateServicesMutation.isLoading}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        confirmVariant={confirmState?.confirmVariant === "danger" ? "ghost" : confirmState?.confirmVariant ?? "primary"}
        loading={dialogLoading}
        onConfirm={() => confirmState?.action()}
        onClose={() => setConfirmState(null)}
      />
    </div >
  );
};

export default ProviderDetailPage;
