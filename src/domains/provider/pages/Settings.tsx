import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GenderSettingRow } from "../components/ProviderSetupCard";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { LegalDocumentsPanel } from "../../../shared/components/LegalDocumentsPanel";
import { Loading } from "../../../shared/components/Loading";
import { useToast } from "../../../shared/components/ToastProvider";
import api from "../../../shared/libs/api";
import { useProviderProfile } from "../hooks/useProviderProfile";
import { useProviderApplication } from "../hooks/useProviderApplication";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const notificationDefaults = [
  { key: "booking", label: "Booking updates" },
  { key: "payments", label: "Payments & wallet" },
  { key: "broadcasts", label: "Broadcast invites" }
];

type ProviderNotificationPrefs = Record<string, boolean>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

// Providers store their notification toggles in the same generic `meta_data` field the
// client Settings page already uses for its own preferences -- no dedicated endpoint exists,
// so this reads/writes a `provider_settings.notifications` key on the same user record.
const extractNotificationPrefs = (meta: Record<string, unknown> | null | undefined): ProviderNotificationPrefs => {
  const providerSettings = meta && isRecord(meta.provider_settings) ? meta.provider_settings : {};
  const notifications = isRecord(providerSettings.notifications) ? providerSettings.notifications : {};
  return notificationDefaults.reduce<ProviderNotificationPrefs>((acc, pref) => {
    acc[pref.key] = typeof notifications[pref.key] === "boolean" ? (notifications[pref.key] as boolean) : true;
    return acc;
  }, {});
};

const ProviderSettings = () => {
  const navigate = useNavigate();
  const { user, bootstrapMe } = useAuth();
  const toast = useToast();
  const { data: profile, isLoading: loadingProfile } = useProviderProfile(user?.id);
  const { data: application, isLoading: loadingApplication } = useProviderApplication(user?.id);

  const storedNotificationPrefs = useMemo(() => extractNotificationPrefs(user?.meta ?? null), [user?.meta]);
  const [notificationPrefs, setNotificationPrefs] = useState<ProviderNotificationPrefs>(storedNotificationPrefs);

  useEffect(() => {
    setNotificationPrefs(storedNotificationPrefs);
  }, [storedNotificationPrefs]);

  const updateNotificationPrefs = useMutation({
    mutationFn: async (nextPrefs: ProviderNotificationPrefs) => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      await api.patch(`/users/${user.id}`, {
        meta_data: { provider_settings: { notifications: nextPrefs } }
      });
    },
    onSuccess: () => {
      void bootstrapMe();
    }
  });

  const pendingItems = useMemo(
    () =>
      application?.items?.filter((item) => item.status === "pending" || item.status === "missing") ?? [],
    [application?.items]
  );

  if (loadingProfile || loadingApplication) {
    return <Loading fullHeight />;
  }

  const togglePref = (key: string) => {
    const previousPrefs = notificationPrefs;
    const nextPrefs = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(nextPrefs);
    updateNotificationPrefs.mutate(nextPrefs, {
      onError: (error: unknown) => {
        setNotificationPrefs(previousPrefs);
        toast.showToast({
          title: "Unable to update notification preference",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error"
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      </header>

      <div className="grid gap-4">
        <LegalDocumentsPanel />

        <Card title="Onboarding">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {application?.status ?? "pending"}
            </span>
            {typeof application?.progress_percent === "number" && (
              <div className="flex-1 min-w-[160px] rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-primary-500 transition-[width]"
                  style={{ width: `${Math.min(100, Math.max(0, application.progress_percent))}%` }}
                />
              </div>
            )}
          </div>
          {pendingItems.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              {pendingItems.map((item) => (
                <li key={item.id}>
                  {item.requirement_type?.label ?? "Requirement"}{" "}
                  {item.comment && <span className="text-slate-500">— {item.comment}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">All requirements look good.</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/pro/onboarding")}>
              Review onboarding
            </Button>
          </div>
        </Card>

        <Card title="Notifications">
          <div className="flex flex-col gap-2">
            {notificationDefaults.map((pref) => {
              const enabled = notificationPrefs[pref.key] ?? true;
              return (
                <button
                  key={pref.key}
                  type="button"
                  disabled={updateNotificationPrefs.isPending}
                  onClick={() => togglePref(pref.key)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    enabled ? "border-primary-400 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span>{pref.label}</span>
                  <span>{enabled ? "On" : "Off"}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Workspace">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <p className="text-slate-500">Availability</p>
              <p className="font-semibold text-slate-900">{profile?.is_available ? "Online" : "Offline"}</p>
            </div>
            <div>
              <p className="text-slate-500">Emergency ready</p>
              <p className="font-semibold text-slate-900">{profile?.can_emergency ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-slate-500">Daily limit</p>
              <p className="font-semibold text-slate-900">{profile?.daily_request_limit ?? "—"}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate("/pro/services")}>
              Manage services
            </Button>
            <Button variant="secondary" onClick={() => navigate("/pro/availability")}>
              Update availability
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProviderSettings;
