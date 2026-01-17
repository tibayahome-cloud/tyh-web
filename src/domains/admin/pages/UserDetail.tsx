import classNames from "classnames";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { Loading } from "../../../shared/components/Loading";
import { useRbac } from "../../../shared/hooks/useRbac";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, userDetail } from "../../../shared/libs/fieldInclude";
import { userResourceSchema } from "../../../shared/schemas/user";

type Role = {
  id: string;
  key: string;
  name: string;
};

type DetailedUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  avatarUrl: string | null;
  preferredLang: string | null;
  tz: string | null;
  twofaEnabled: boolean;
  twofaMethod: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  roles: Role[];
};

type SessionItem = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: string;
  revokedAt: string | null;
  reason: string | null;
  isActive: boolean;
};

type AuditEntry = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  fieldList: string[];
  reason: string | null;
  decision: string;
  at: string;
};

type ActivityPayload = {
  audit: AuditEntry[];
};

type ConfirmState =
  | {
      title: string;
      description?: string;
      confirmLabel: string;
      confirmVariant?: "primary" | "secondary";
      action: () => void;
    }
  | null;

const detailFormSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .optional(),
  phone: z.string().trim().optional(),
  preferredLang: z.string().trim().optional(),
  tz: z.string().trim().optional(),
  status: z.enum(["pending", "active", "suspended"]),
});

type DetailFormValues = z.infer<typeof detailFormSchema>;

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const mapDetailedUser = (resource: unknown): DetailedUser => {
  const parsed = userResourceSchema.parse(resource);
  const base =
    "attributes" in parsed && parsed.attributes ? parsed.attributes : (parsed as Record<string, unknown>);

  const idSource = (parsed as { id?: unknown }).id ?? (base as { id?: unknown }).id;
  const coerceId = (value: unknown): string => {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number") {
      return value.toString();
    }
    return "";
  };

  const toRole = (role: unknown, idx: number): Role => {
    if (!role || typeof role !== "object") {
      return { id: String(idx), key: "unknown", name: "Unknown" };
    }
    const candidate = role as { id?: unknown; key?: unknown; name?: unknown };
    return {
      id: coerceId(candidate.id ?? idx),
      key: typeof candidate.key === "string" ? candidate.key : "unknown",
      name:
        typeof candidate.name === "string"
          ? candidate.name
          : typeof candidate.key === "string"
          ? candidate.key
          : "Unknown",
    };
  };

  const rolesRaw = (base as { roles?: unknown[] }).roles;

  return {
    id: coerceId(idSource),
    fullName:
      ((base as { full_name?: string | null }).full_name ??
        (base as { fullName?: string | null }).fullName ??
        "") || "",
    email: ((base as { email?: string | null }).email ?? null) || null,
    phone: ((base as { phone?: string | null }).phone ?? null) || null,
    status: ((base as { status?: string }).status ?? "pending") || "pending",
    avatarUrl: ((base as { avatar_url?: string | null }).avatar_url ?? null) || null,
    preferredLang: ((base as { preferred_lang?: string | null }).preferred_lang ?? null) || null,
    tz: ((base as { tz?: string | null }).tz ?? null) || null,
    twofaEnabled: Boolean((base as { twofa_enabled?: boolean }).twofa_enabled),
    twofaMethod: ((base as { twofa_method?: string | null }).twofa_method ?? null) || null,
    emailVerifiedAt: ((base as { email_verified_at?: string | null }).email_verified_at ?? null) || null,
    phoneVerifiedAt: ((base as { phone_verified_at?: string | null }).phone_verified_at ?? null) || null,
    lastLoginAt: ((base as { last_login_at?: string | null }).last_login_at ?? null) || null,
    createdAt: ((base as { created_at?: string | null }).created_at ?? null) || null,
    updatedAt: ((base as { updated_at?: string | null }).updated_at ?? null) || null,
    roles: Array.isArray(rolesRaw) ? rolesRaw.map(toRole) : [],
  };
};

const mapSession = (session: unknown): SessionItem => {
  if (!session || typeof session !== "object") {
    return {
      id: "",
      ip: null,
      userAgent: null,
      expiresAt: "",
      revokedAt: null,
      reason: null,
      isActive: false,
    };
  }
  const value = session as {
    id?: unknown;
    ip?: unknown;
    ua?: unknown;
    expires_at?: unknown;
    revoked_at?: unknown;
    reason?: unknown;
  };

  const coerceString = (input: unknown): string | null =>
    typeof input === "string" && input.trim() ? input : null;

  const expiresAt = coerceString(value.expires_at) ?? "";
  const revokedAt = coerceString(value.revoked_at);

  return {
    id: typeof value.id === "string" ? value.id : "",
    ip: coerceString(value.ip),
    userAgent: coerceString(value.ua),
    expiresAt,
    revokedAt,
    reason: coerceString(value.reason),
    isActive: !revokedAt,
  };
};

const mapAuditEntry = (entry: unknown): AuditEntry => {
  if (!entry || typeof entry !== "object") {
    return {
      id: "",
      action: "unknown",
      resourceType: "unknown",
      resourceId: null,
      fieldList: [],
      reason: null,
      decision: "allow",
      at: "",
    };
  }
  const value = entry as {
    id?: unknown;
    action?: unknown;
    resource_type?: unknown;
    resource_id?: unknown;
    field_list?: unknown;
    reason?: unknown;
    decision?: unknown;
    at?: unknown;
  };

  return {
    id: typeof value.id === "string" ? value.id : "",
    action: typeof value.action === "string" ? value.action : "unknown",
    resourceType: typeof value.resource_type === "string" ? value.resource_type : "unknown",
    resourceId: typeof value.resource_id === "string" ? value.resource_id : null,
    fieldList: Array.isArray(value.field_list)
      ? value.field_list
          .map((item) => (typeof item === "string" ? item : null))
          .filter((item): item is string => Boolean(item))
      : [],
    reason: typeof value.reason === "string" ? value.reason : null,
    decision: typeof value.decision === "string" ? value.decision : "allow",
    at: typeof value.at === "string" ? value.at : "",
  };
};

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

const SectionTitle = ({ title }: { title: string }) => (
  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
);

const statusChipClasses: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700",
  deleted: "bg-slate-200 text-slate-600",
};

const computeInitials = (name?: string | null, email?: string | null) => {
  const source = name?.trim() || email?.trim() || "";
  if (!source) {
    return "U";
  }
  const parts = source.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

const UserDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useRbac();

  const canUpdateUser = hasPermission("user:update");
  const canDeleteUser = hasPermission("user:delete");
  const canVerifyEmail = hasPermission("auth:verify.email");
  const canVerifyPhone = hasPermission("auth:verify.phone");
  const canResetPassword = hasPermission("auth:password_reset.admin");
  const canManageSessions = hasPermission("auth:sessions.invalidate");

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [securityBanner, setSecurityBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const detailForm = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      preferredLang: "",
      tz: "",
      status: "pending",
    },
  });

  const userQuery = useQuery({
    queryKey: ["admin", "users", "detail", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const params = buildFieldParams(userDetail);
      const response = await api.get<{ data: unknown }>(`/users/${userId}`, { params });
      return mapDetailedUser(response.data.data);
    },
  });

  const roleOptionsQuery = useQuery({
    queryKey: ["admin", "rbac", "roles"],
    queryFn: async () => {
      const response = await api.get<{ data: Role[] }>("/rbac/roles");
      return response.data.data;
    },
    staleTime: 5 * 60_000,
    enabled: canUpdateUser,
  });

  const sessionsQuery = useQuery({
    queryKey: ["admin", "users", "sessions", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await api.get<{ data: unknown[] }>(`/users/${userId}/sessions`, {
        params: { limit: "50" },
      });
      return response.data.data.map(mapSession);
    },
  });

  const activityQuery = useQuery({
    queryKey: ["admin", "users", "activity", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await api.get<{ data: ActivityPayload }>(`/users/${userId}/activity`, {
        params: { audit_limit: "20" },
      });
      return {
        audit: response.data.data.audit.map(mapAuditEntry),
      };
    },
  });

  const selectedUser = userQuery.data;
  const roleOptions = roleOptionsQuery.data ?? [];

  useEffect(() => {
    if (!selectedUser) {
      return;
    }
    const statusValue = ["pending", "active", "suspended"].includes(selectedUser.status)
      ? (selectedUser.status as "pending" | "active" | "suspended")
      : "pending";
    detailForm.reset({
      fullName: selectedUser.fullName,
      email: selectedUser.email ?? "",
      phone: selectedUser.phone ?? "",
      preferredLang: selectedUser.preferredLang ?? "",
      tz: selectedUser.tz ?? "",
      status: statusValue,
    });
  }, [detailForm, selectedUser]);

  const invalidateUserData = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users", "detail", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users", "list"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users", "metrics"] });
  };

  const updateUserMutation = useMutation({
    mutationFn: async (payload: Partial<{ full_name: string; email: string | null; phone: string | null; preferred_lang: string | null; tz: string | null; status: string }>) => {
      await api.patch(`/users/${userId}`, payload);
    },
    onSuccess: () => {
      invalidateUserData();
      setConfirmState(null);
    },
    onError: (error) => {
      const message = extractErrorMessage(error);
      detailForm.setError("fullName", { type: "server", message });
      detailForm.setError("email", { type: "server", message });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ channel, verified }: { channel: "email" | "phone"; verified: boolean }) => {
      await api.post(`/users/${userId}/verify`, { channel, verified });
    },
    onSuccess: () => {
      invalidateUserData();
      setConfirmState(null);
    },
    onError: (error) => setConfirmError(extractErrorMessage(error)),
  });

  const sessionRevokeMutation = useMutation({
    mutationFn: async (payload: { sessionId?: string }) => {
      await api.post(`/users/${userId}/sessions/revoke`, payload.sessionId ? { session_id: payload.sessionId } : {});
    },
    onSuccess: () => {
      sessionsQuery.refetch();
      setConfirmState(null);
      setConfirmError(null);
    },
    onError: (error) => setConfirmError(extractErrorMessage(error)),
  });

  const passwordResetMutation = useMutation({
    mutationFn: async ({ channel }: { channel: "email" | "sms" }) => {
      setSecurityBanner(null);
      await api.post("/auth/password-reset/admin/init", { user_id: userId, delivery_channel: channel });
    },
    onSuccess: (_, variables) => {
      setSecurityBanner({
        tone: "success",
        message:
          variables.channel === "email"
            ? "Email password reset instructions have been sent."
            : "SMS password reset instructions have been sent.",
      });
      setConfirmState(null);
    },
    onError: (error) => setSecurityBanner({ tone: "error", message: extractErrorMessage(error) }),
  });

  const twofaDisableMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/users/${userId}/twofa/disable`);
    },
    onSuccess: () => {
      invalidateUserData();
      setSecurityBanner({ tone: "success", message: "Two-factor authentication disabled." });
      setConfirmState(null);
    },
    onError: (error) => setSecurityBanner({ tone: "error", message: extractErrorMessage(error) }),
  });

  const twofaEnableMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/users/${userId}/twofa/enable`, { method: "sms" });
    },
    onSuccess: () => {
      invalidateUserData();
      setSecurityBanner({ tone: "success", message: "Two-factor authentication (SMS) enabled." });
      setConfirmState(null);
    },
    onError: (error) => setSecurityBanner({ tone: "error", message: extractErrorMessage(error) }),
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/auth/users/${userId}/suspend`, { reason: "admin_suspend" });
    },
    onSuccess: () => {
      invalidateUserData();
      setConfirmState(null);
      setConfirmError(null);
      sessionsQuery.refetch();
    },
    onError: (error) => setConfirmError(extractErrorMessage(error)),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/users/${userId}`, { status: "active" });
    },
    onSuccess: () => {
      invalidateUserData();
      setConfirmState(null);
      setConfirmError(null);
      sessionsQuery.refetch();
    },
    onError: (error) => setConfirmError(extractErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/users/${userId}`, { data: { reason: "admin_delete" } });
    },
    onSuccess: () => {
      invalidateUserData();
      navigate("/admin/users");
      setConfirmState(null);
    },
    onError: (error) => setConfirmError(extractErrorMessage(error)),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/users/${userId}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      invalidateUserData();
      setAvatarError(null);
      setSecurityBanner({ tone: "success", message: "Profile image updated." });
    },
    onError: (error) => {
      setAvatarError(extractErrorMessage(error));
    },
  });

  const avatarDeleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/users/${userId}/avatar`);
    },
    onSuccess: () => {
      invalidateUserData();
      setAvatarError(null);
      setSecurityBanner({ tone: "success", message: "Profile image removed." });
      setConfirmState(null);
    },
    onError: (error) => {
      setAvatarError(extractErrorMessage(error));
    },
  });

  const rolesMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      await api.put(`/users/${userId}/roles`, { roles });
    },
    onSuccess: () => {
      invalidateUserData();
      setSecurityBanner({ tone: "success", message: "Roles updated." });
      setConfirmState(null);
    },
    onError: (error) => setSecurityBanner({ tone: "error", message: extractErrorMessage(error) }),
  });

  const confirmLoading =
    suspendMutation.isPending ||
    activateMutation.isPending ||
    deleteMutation.isPending ||
    sessionRevokeMutation.isPending ||
    passwordResetMutation.isPending ||
    twofaDisableMutation.isPending ||
    twofaEnableMutation.isPending ||
    verifyMutation.isPending ||
    rolesMutation.isPending ||
    avatarMutation.isPending ||
    avatarDeleteMutation.isPending;

  const onSubmit = detailForm.handleSubmit((values) => {
    if (!selectedUser) {
      return;
    }
    const payload: Partial<{
      full_name: string;
      email: string | null;
      phone: string | null;
      preferred_lang: string | null;
      tz: string | null;
      status: string;
    }> = {};
    const { dirtyFields } = detailForm.formState;

    if (dirtyFields.fullName) {
      payload.full_name = values.fullName.trim();
    }
    if (dirtyFields.email) {
      payload.email = values.email?.trim() ? values.email.trim() : null;
    }
    if (dirtyFields.phone) {
      payload.phone = values.phone?.trim() || null;
    }
    if (dirtyFields.preferredLang) {
      payload.preferred_lang = values.preferredLang?.trim() || null;
    }
    if (dirtyFields.tz) {
      payload.tz = values.tz?.trim() || null;
    }
    if (dirtyFields.status && canUpdateUser) {
      payload.status = values.status;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    updateUserMutation.mutate(payload);
  });

  const handleVerifyToggle = useCallback(
    (channel: "email" | "phone", verified: boolean) => {
      setSecurityBanner(null);
      verifyMutation.mutate({ channel, verified });
    },
    [verifyMutation],
  );

  const handleRevokeSession = (sessionId?: string) => {
    sessionRevokeMutation.mutate({ sessionId });
  };

  const openConfirm = (config: ConfirmState) => {
    setConfirmError(null);
    setConfirmState(config);
  };

  const handleConfirm = () => {
    if (!confirmState) {
      return;
    }
    confirmState.action();
  };

  const handleAvatarButtonClick = () => {
    if (!canUpdateUser) {
      return;
    }
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setAvatarError(null);
    avatarMutation.mutate(file);
    event.target.value = "";
  };

  const handleRoleToggle = (roleKey: string, assign: boolean) => {
    if (!selectedUser) {
      return;
    }
    const currentRoles = new Set(selectedUser.roles.map((role) => role.key));
    const nextRoles = new Set(currentRoles);
    if (assign) {
      nextRoles.add(roleKey);
    } else {
      nextRoles.delete(roleKey);
    }
    const label = roleOptions.find((role) => role.key === roleKey)?.name ?? roleKey;
    const removingProvider = !assign && roleKey === "provider";
    const description = assign
      ? `Grant the ${label} role to ${selectedUser.fullName || selectedUser.email || "this user"}.`
      : removingProvider
      ? "Removing the provider role will permanently delete their provider profile, services, and availability. Continue?"
      : `Remove the ${label} role from ${selectedUser.fullName || selectedUser.email || "this user"}.`;
    openConfirm({
      title: assign ? "Assign role?" : "Remove role?",
      description,
      confirmLabel: assign ? "Assign role" : removingProvider ? "Remove and delete profile" : "Remove role",
      action: () => rolesMutation.mutate(Array.from(nextRoles)),
    });
  };

  const handlePasswordReset = (channel: "email" | "sms") => {
    setSecurityBanner(null);
    passwordResetMutation.mutate({ channel });
  };

  if (!userId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card>
          <p className="text-sm text-slate-600">User not found.</p>
        </Card>
      </div>
    );
  }

  if (userQuery.isLoading || userQuery.isFetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading label="Loading user details" />
      </div>
    );
  }

  if (userQuery.isError || !selectedUser) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => navigate("/admin/users")}>
          Back to users
        </Button>
        <Card>
          <p className="text-sm text-red-600">Unable to load user details.</p>
        </Card>
      </div>
    );
  }

  const statusClass = statusChipClasses[selectedUser.status] ?? "bg-slate-200 text-slate-600";
  const sessions = sessionsQuery.data ?? [];
  const auditEntries = activityQuery.data?.audit ?? [];
  const initials = computeInitials(selectedUser.fullName, selectedUser.email);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-primary-700 text-white shadow-xl">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-6">
            <div className="relative h-28 w-28">
              {selectedUser.avatarUrl ? (
                <img
                  src={selectedUser.avatarUrl}
                  alt={selectedUser.fullName}
                  className="h-full w-full rounded-full object-cover ring-4 ring-white/20"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white/20 text-3xl font-semibold uppercase">
                  {initials}
                </div>
              )}
              {canUpdateUser && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    className="absolute bottom-2 right-2 inline-flex h-9 items-center justify-center rounded-full bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-lg transition hover:bg-white"
                    disabled={avatarMutation.isPending}
                  >
                    {avatarMutation.isPending ? "Uploading…" : "Change"}
                  </button>
                </>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{selectedUser.fullName || "Unnamed user"}</h1>
                <p className="text-sm text-slate-200">{selectedUser.email || "—"}</p>
                <p className="text-xs text-slate-300">User ID: {selectedUser.id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={classNames("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", statusClass)}>
                  {selectedUser.status}
                </span>
                <span
                  className={classNames(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                    selectedUser.twofaEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                  )}
                >
                  {selectedUser.twofaEnabled ? "Two-factor enabled" : "Two-factor disabled"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-100">
                {selectedUser.roles.length
                  ? selectedUser.roles.map((role) => (
                      <span key={role.id} className="inline-flex items-center rounded-full bg-white/15 px-2 py-1 font-semibold">
                        {role.name}
                      </span>
                    ))
                  : "No roles assigned"}
              </div>
            </div>
          </div>
          <div className="grid w-full gap-3 md:w-80">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs text-slate-200">Last login</p>
              <p className="text-lg font-semibold">
                {selectedUser.lastLoginAt ? dateTimeFormatter.format(new Date(selectedUser.lastLoginAt)) : "No activity"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs text-slate-200">Joined</p>
              <p className="text-lg font-semibold">
                {selectedUser.createdAt ? dateTimeFormatter.format(new Date(selectedUser.createdAt)) : "Unknown"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {avatarError && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">{avatarError}</p>}

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-6">
          <Card>
            <SectionTitle title="Contact" />
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-800">Email</p>
                <p>{selectedUser.email || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Phone</p>
                <p>{selectedUser.phone || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Preferred language</p>
                <p>{selectedUser.preferredLang || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Timezone</p>
                <p>{selectedUser.tz || "—"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Role assignment" />
            <div className="mt-4 space-y-2">
              {!canUpdateUser ? (
                <p className="text-sm text-slate-500">You do not have permission to modify roles.</p>
              ) : roleOptionsQuery.isLoading ? (
                <Loading label="Loading roles" />
              ) : roleOptions.length === 0 ? (
                <p className="text-sm text-slate-500">No roles available.</p>
              ) : (
                roleOptions.map((role) => {
                  const checked = selectedUser.roles.some((item) => item.key === role.key);
                  return (
                    <label key={role.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span>
                        <span className="font-semibold text-slate-800">{role.name}</span>
                        <span className="block text-xs text-slate-500">{role.key}</span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        disabled={!canUpdateUser || rolesMutation.isPending}
                        onChange={(event) => {
                          event.preventDefault();
                          handleRoleToggle(role.key, !checked);
                        }}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle title="Verification" />
            <div className="mt-4 space-y-2 text-sm">
              <Button
                variant="secondary"
                className="w-full justify-start"
                disabled={!canVerifyEmail || !selectedUser.email || verifyMutation.isPending}
                onClick={() =>
                  openConfirm({
                    title: selectedUser.emailVerifiedAt ? "Unverify email?" : "Verify email?",
                    description: selectedUser.emailVerifiedAt
                      ? `Mark ${selectedUser.email} as unverified. This may restrict access until verification is re-completed.`
                      : `Mark ${selectedUser.email} as verified and trust email-based flows for this user.`,
                    confirmLabel: selectedUser.emailVerifiedAt ? "Unverify email" : "Verify email",
                    action: () => handleVerifyToggle("email", !selectedUser.emailVerifiedAt),
                  })
                }
              >
                {selectedUser.emailVerifiedAt ? "Mark email as unverified" : "Mark email as verified"}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                disabled={!canVerifyPhone || !selectedUser.phone || verifyMutation.isPending}
                onClick={() =>
                  openConfirm({
                    title: selectedUser.phoneVerifiedAt ? "Unverify phone?" : "Verify phone?",
                    description: selectedUser.phoneVerifiedAt
                      ? `Mark ${selectedUser.phone} as unverified. The user will be prompted to confirm again.`
                      : `Mark ${selectedUser.phone} as verified so SMS flows are allowed.`,
                    confirmLabel: selectedUser.phoneVerifiedAt ? "Unverify phone" : "Verify phone",
                    action: () => handleVerifyToggle("phone", !selectedUser.phoneVerifiedAt),
                  })
                }
              >
                {selectedUser.phoneVerifiedAt ? "Mark phone as unverified" : "Mark phone as verified"}
              </Button>
            </div>
          </Card>
        </aside>

        <section className="space-y-6">
          <Card>
            <SectionTitle title="Account controls" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedUser.twofaEnabled ? (
                <Button
                  variant="secondary"
                  className="md:col-span-2 justify-start"
                  disabled={!canUpdateUser || twofaDisableMutation.isPending}
                  onClick={() =>
                    openConfirm({
                      title: "Disable two-factor authentication?",
                      description: "Disabling 2FA reduces account security and allows password-only logins.",
                      confirmLabel: "Disable 2FA",
                      confirmVariant: "secondary",
                      action: () => {
                        setSecurityBanner(null);
                        twofaDisableMutation.mutate();
                      },
                    })
                  }
                >
                  Disable two-factor authentication
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="md:col-span-2 justify-start"
                  disabled={!canUpdateUser || !selectedUser.phoneVerifiedAt || twofaEnableMutation.isPending}
                  onClick={() =>
                    openConfirm({
                      title: "Enable SMS two-factor?",
                      description: "A verification code will be required at login. Ensure the phone number is reachable.",
                      confirmLabel: "Enable 2FA",
                      action: () => {
                        setSecurityBanner(null);
                        twofaEnableMutation.mutate();
                      },
                    })
                  }
                >
                  Enable SMS two-factor authentication
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={!canResetPassword || !selectedUser.email || passwordResetMutation.isPending}
                onClick={() =>
                  openConfirm({
                    title: "Send password reset email?",
                    description: `An email will be sent to ${selectedUser.email}.`,
                    confirmLabel: "Send email",
                    action: () => handlePasswordReset("email"),
                  })
                }
              >
                Send password reset (email)
              </Button>
              <Button
                variant="secondary"
                disabled={!canResetPassword || !selectedUser.phone || passwordResetMutation.isPending}
                onClick={() =>
                  openConfirm({
                    title: "Send password reset SMS?",
                    description: `A reset link will be sent to ${selectedUser.phone}.`,
                    confirmLabel: "Send SMS",
                    action: () => handlePasswordReset("sms"),
                  })
                }
              >
                Send password reset (SMS)
              </Button>
              {canManageSessions && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    openConfirm({
                      title: "Revoke all sessions?",
                      description: `All active sessions for ${selectedUser.fullName || "this user"} will be revoked immediately.`,
                      confirmLabel: "Revoke sessions",
                      action: () => handleRevokeSession(),
                    })
                  }
                >
                  Revoke all sessions
                </Button>
              )}
              {canUpdateUser && selectedUser.status !== "suspended" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    openConfirm({
                      title: "Suspend user?",
                      description: `Suspending prevents ${selectedUser.fullName || "this user"} from signing in until reactivated.`,
                      confirmLabel: "Suspend user",
                      action: () => suspendMutation.mutate(),
                    })
                  }
                >
                  Suspend account
                </Button>
              )}
              {canUpdateUser && selectedUser.status === "suspended" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    openConfirm({
                      title: "Activate user?",
                      description: `This will restore access for ${selectedUser.fullName || "this user"}.`,
                      confirmLabel: "Activate user",
                      action: () => activateMutation.mutate(),
                    })
                  }
                >
                  Activate account
                </Button>
              )}
              {canDeleteUser && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    openConfirm({
                      title: "Delete user?",
                      description: `Deleting will revoke sessions and archive ${selectedUser.fullName || "this user"}.`,
                      confirmLabel: "Delete user",
                      confirmVariant: "secondary",
                      action: () => deleteMutation.mutate(),
                    })
                  }
                >
                  Delete account
                </Button>
              )}
            </div>
            {!selectedUser.twofaEnabled && !selectedUser.phoneVerifiedAt && (
              <p className="text-xs text-amber-600">
                Phone verification is required before enabling SMS two-factor authentication.
              </p>
            )}
            {securityBanner && (
              <p
                className={classNames(
                  "mt-3 rounded-lg px-3 py-2 text-xs",
                  securityBanner.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600",
                )}
              >
                {securityBanner.message}
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle title="Profile details" />
            <form className="mt-4 space-y-4" onSubmit={onSubmit}>
              <FormField
                control={detailForm.control}
                name="fullName"
                render={({ field, fieldState }) => (
                  <Input {...field} label="Full name" error={fieldState.error?.message} placeholder="Full name" />
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={detailForm.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      type="email"
                      label="Email address"
                      placeholder="name@example.com"
                      error={fieldState.error?.message}
                      disabled={!canUpdateUser}
                    />
                  )}
                />
                <FormField
                  control={detailForm.control}
                  name="phone"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Phone number"
                      placeholder="+2547..."
                      error={fieldState.error?.message}
                      disabled={!canUpdateUser}
                    />
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={detailForm.control}
                  name="preferredLang"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Preferred language"
                      placeholder="e.g. en"
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <FormField
                  control={detailForm.control}
                  name="tz"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Timezone"
                      placeholder="Africa/Nairobi"
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </div>
              {canUpdateUser && (
                <FormField
                  control={detailForm.control}
                  name="status"
                  render={({ field, fieldState }) => (
                    <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                      <span>Status</span>
                      <select
                        {...field}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      {fieldState.error && <span className="text-xs text-red-500">{fieldState.error.message}</span>}
                    </label>
                  )}
                />
              )}
              <div className="flex justify-end">
                <Button loading={updateUserMutation.isPending} type="submit">
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => setSessionsOpen((prev) => !prev)}
            >
              <div className="flex-1">
                <SectionTitle title="Sessions" />
                <p className="mt-1 text-xs text-slate-500">{sessions.length} session{sessions.length === 1 ? "" : "s"}</p>
              </div>
              <span
                className={classNames(
                  "ml-auto text-lg text-slate-400 transition-transform duration-200 transform",
                  { "rotate-180": sessionsOpen }
                )}
                aria-hidden="true"
              >
                ⌄
              </span>
            </button>
            {sessionsOpen && (
              <div className="mt-4">
                {sessionsQuery.isLoading ? (
                  <div className="py-6">
                    <Loading label="Loading sessions" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="py-4 text-sm text-slate-500">No sessions recorded.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm text-slate-600">
                        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-2">Status</th>
                            <th className="py-2">Expires</th>
                            <th className="py-2">IP</th>
                            <th className="py-2">User agent</th>
                            <th className="py-2">Reason</th>
                            {canManageSessions && <th className="py-2 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((session) => (
                            <tr key={session.id} className="border-b border-slate-100 last:border-none">
                              <td className="py-2">
                                <span
                                  className={classNames(
                                    "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                                    session.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                                  )}
                                >
                                  {session.isActive ? "Active" : "Revoked"}
                                </span>
                              </td>
                              <td className="py-2">
                                {session.expiresAt ? dateTimeFormatter.format(new Date(session.expiresAt)) : "—"}
                                {session.revokedAt && (
                                  <span className="block text-xs text-slate-400">
                                    Revoked {dateTimeFormatter.format(new Date(session.revokedAt))}
                                  </span>
                                )}
                              </td>
                              <td className="py-2">{session.ip || "—"}</td>
                              <td className="py-2">
                                <span className="line-clamp-2 break-words text-xs text-slate-500">
                                  {session.userAgent || "—"}
                                </span>
                              </td>
                              <td className="py-2 text-xs text-slate-500">{session.reason || "—"}</td>
                              {canManageSessions && (
                                <td className="py-2 text-right">
                                  <Button
                                    variant="secondary"
                                    className="text-xs"
                                    disabled={!session.isActive || sessionRevokeMutation.isPending}
                                    onClick={() =>
                                      openConfirm({
                                        title: "Revoke session?",
                                        description: "This session will be signed out immediately.",
                                        confirmLabel: "Revoke session",
                                        action: () => handleRevokeSession(session.id),
                                      })
                                    }
                                  >
                                    Revoke
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => setAuditOpen((prev) => !prev)}
            >
              <div className="flex-1">
                <SectionTitle title="Audit trail" />
                <p className="mt-1 text-xs text-slate-500">
                  {auditEntries.length} event{auditEntries.length === 1 ? "" : "s"}
                </p>
              </div>
              <span
                className={classNames(
                  "ml-auto text-lg text-slate-400 transition-transform duration-200 transform",
                  { "rotate-180": auditOpen }
                )}
                aria-hidden="true"
              >
                ⌄
              </span>
            </button>
            {auditOpen && (
              <div className="mt-4">
                {activityQuery.isLoading ? (
                  <div className="py-6">
                    <Loading label="Loading audit logs" />
                  </div>
                ) : auditEntries.length === 0 ? (
                  <p className="py-4 text-sm text-slate-500">No audit events recorded.</p>
                ) : (
                  <ul className="max-h-72 space-y-3 overflow-y-auto text-sm text-slate-600">
                    {auditEntries.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="font-semibold text-slate-800">
                          {entry.action} • {entry.resourceType}
                        </p>
                        <p className="text-xs text-slate-500">
                          {dateTimeFormatter.format(new Date(entry.at))}
                        </p>
                        {entry.fieldList.length > 0 && (
                          <p className="text-xs text-slate-500">Fields: {entry.fieldList.join(", ")}</p>
                        )}
                        {entry.reason && <p className="text-xs text-slate-500">Reason: {entry.reason}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        confirmVariant={confirmState?.confirmVariant ?? "primary"}
        loading={confirmLoading}
        error={confirmError ?? undefined}
        onClose={() => {
          if (!confirmLoading) {
            setConfirmState(null);
            setConfirmError(null);
          }
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default UserDetailPage;
