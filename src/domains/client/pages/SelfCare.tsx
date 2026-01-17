import { useEffect, useMemo, useState } from "react";
import { NotebookPen, Activity, ShieldCheck, ChevronDown } from "lucide-react";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { Spinner } from "../../../shared/components/Spinner";
import { useToast } from "../../../shared/components/ToastProvider";
import {
  useSelfCareProfile,
  useSelfCareCheckins,
  useCreateSelfCareCheckinMutation,
  useUpdateSelfCareProfileMutation
} from "../../../shared/hooks/useSelfCare";
import type { SelfCareCheckin } from "../../../shared/schemas/selfcare";

const moodOptions = ["steady", "low", "anxious", "energized", "exhausted"];

const riskTone: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700",
  moderate: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  emergency: "bg-red-50 text-red-700"
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) {
    return "Just now";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatRelative = (iso?: string | null) => {
  if (!iso) {
    return "moments ago";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "moments ago";
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "moments ago";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const RiskBadge = ({ risk }: { risk?: string | null }) => {
  const label = (risk ?? "moderate").toLowerCase();
  const tone = riskTone[label] ?? riskTone.moderate;
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tone}`}>{label}</span>;
};

type ProfileFormState = {
  consentAi: boolean;
  consentData: boolean;
  primaryGoals: string;
  notificationChannel: string;
  quietHours: string;
};

const buildProfileFormState = (profile?: ReturnType<typeof useSelfCareProfile>["data"]): ProfileFormState => ({
  consentAi: profile?.consentAi ?? false,
  consentData: profile?.consentDataSharing ?? false,
  primaryGoals: profile?.primaryGoals ?? "",
  notificationChannel: (profile?.preferences?.notification_channel as string) ?? "push",
  quietHours: (profile?.preferences?.quiet_hours as string) ?? ""
});

type CheckinFormState = {
  mood: string;
  note: string;
  symptoms: string;
  bpSystolic?: string;
  bpDiastolic?: string;
  heartRate?: string;
  temperature?: string;
  spo2?: string;
};

const initialCheckinState: CheckinFormState = {
  mood: "",
  note: "",
  symptoms: "",
  bpSystolic: "",
  bpDiastolic: "",
  heartRate: "",
  temperature: "",
  spo2: ""
};

const buildDateKey = (iso?: string | null) => {
  if (!iso) {
    return "unknown";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return date.toISOString().slice(0, 10);
};

const formatDateLabel = (key: string) => {
  if (key === "unknown") {
    return "Undated entries";
  }
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return "Undated entries";
  }
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

const SelfCarePage = () => {
  const profileQuery = useSelfCareProfile();
  const checkinsQuery = useSelfCareCheckins(undefined, { limit: 10 });
  const createCheckin = useCreateSelfCareCheckinMutation();
  const updateProfile = useUpdateSelfCareProfileMutation();
  const { showToast } = useToast();

  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => buildProfileFormState(profileQuery.data));
  const [checkinForm, setCheckinForm] = useState<CheckinFormState>(initialCheckinState);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setProfileForm(buildProfileFormState(profileQuery.data));
  }, [profileQuery.data]);

  const latestCheckin = useMemo<SelfCareCheckin | null>(() => {
    return (checkinsQuery.data ?? [])[0] ?? null;
  }, [checkinsQuery.data]);

  const groupedCheckins = useMemo(() => {
    const entries = checkinsQuery.data ?? [];
    const map = new Map<string, SelfCareCheckin[]>();
    entries.forEach((entry) => {
      const key = buildDateKey(entry.checkedAt);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .map(([key, list]) => ({
        key,
        label: formatDateLabel(key),
        entries: list.sort((a, b) => {
          const left = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
          const right = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
          return right - left;
        })
      }))
      .sort((a, b) => {
        if (a.key === "unknown") {
          return 1;
        }
        if (b.key === "unknown") {
          return -1;
        }
        return a.key < b.key ? 1 : -1;
      });
  }, [checkinsQuery.data]);

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const next: Record<string, boolean> = {};
      groupedCheckins.forEach((group, index) => {
        next[group.key] = prev[group.key] ?? index > 0;
      });
      return next;
    });
  }, [groupedCheckins]);

  const handleProfileSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile
      .mutateAsync({
        consentAi: profileForm.consentAi,
        consentDataSharing: profileForm.consentData,
        primaryGoals: profileForm.primaryGoals,
        preferences: {
          notification_channel: profileForm.notificationChannel,
          quiet_hours: profileForm.quietHours
        }
      })
      .then(() => {
        showToast({
          title: "Preferences updated",
          description: "We'll personalize reminders around your routine.",
          variant: "success"
        });
      })
      .catch((error) => {
        showToast({
          title: "Unable to save",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error"
        });
      });
  };

  const handleCheckinSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const vitals = {
      bpSystolic: checkinForm.bpSystolic ? Number(checkinForm.bpSystolic) : undefined,
      bpDiastolic: checkinForm.bpDiastolic ? Number(checkinForm.bpDiastolic) : undefined,
      heartRate: checkinForm.heartRate ? Number(checkinForm.heartRate) : undefined,
      temperature: checkinForm.temperature ? Number(checkinForm.temperature) : undefined,
      spo2: checkinForm.spo2 ? Number(checkinForm.spo2) : undefined
    };
    createCheckin
      .mutateAsync({
        mood: checkinForm.mood || undefined,
        note: checkinForm.note || undefined,
        symptoms: checkinForm.symptoms
          .split(/[,]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
        vitals
      })
      .then(() => {
        showToast({
          title: "Check-in submitted",
          description: "Thanks for sharing how you're feeling today.",
          variant: "success"
        });
        setCheckinForm(initialCheckinState);
      })
      .catch((error) => {
        showToast({
          title: "Unable to log check-in",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error"
        });
      });
  };

  const renderRecommendation = () => {
    if (checkinsQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      );
    }
    if (!latestCheckin?.recommendation) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Submit your first check-in to unlock AI-assisted tips tailored to your routine.
        </div>
      );
    }
    const recommendation = latestCheckin.recommendation;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase text-slate-500">Latest insight</p>
            <p className="text-lg font-semibold text-slate-900">{recommendation.summary}</p>
          </div>
          <RiskBadge risk={recommendation.riskLevel} />
        </div>
        <div className="space-y-3">
          {recommendation.steps.map((step) => (
            <div key={step.title} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="text-sm text-slate-600">{step.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {step.timeframe && <span>When: {step.timeframe}</span>}
                    {step.caution && <span className="text-red-500">Note: {step.caution}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">When to seek help</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {recommendation.whenToSeekHelp.map((item) => (
              <li key={`${item.trigger}-${item.description}`}>
                <span className="font-medium">{item.trigger}:</span> {item.description}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const renderHistoryEntry = (entry: SelfCareCheckin) => (
    <li key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{formatDateTime(entry.checkedAt)}</p>
          {entry.mood && <p className="text-xs uppercase tracking-wide text-slate-500">Mood: {entry.mood}</p>}
        </div>
        <RiskBadge risk={entry.aiRiskLevel} />
      </div>
      {entry.symptoms.length > 0 && (
        <div className="mt-3 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Symptoms</p>
          <p>{entry.symptoms.map((symptom) => symptom.label).join(", ")}</p>
        </div>
      )}
      {entry.vitals.bpSystolic && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 md:grid-cols-4">
          <div>BP: {entry.vitals.bpSystolic}/{entry.vitals.bpDiastolic ?? "--"} mmHg</div>
          {entry.vitals.heartRate && <div>HR: {entry.vitals.heartRate} bpm</div>}
          {entry.vitals.temperature && <div>Temp: {entry.vitals.temperature}°C</div>}
          {entry.vitals.spo2 && <div>SpO₂: {entry.vitals.spo2}%</div>}
        </div>
      )}
      {entry.note && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{entry.note}</p>}
    </li>
  );

  const renderHistory = () => {
    if (checkinsQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      );
    }
    if (!groupedCheckins.length) {
      return (
        <p className="text-sm text-slate-500">
          No check-ins recorded yet. Logging daily updates helps us keep recommendations aligned with your goals.
        </p>
      );
    }
    return (
      <div className="space-y-4">
        {groupedCheckins.map((group) => {
          const collapsed = collapsedGroups[group.key] ?? false;
          return (
            <div key={group.key} className="rounded-3xl border border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                  <p className="text-xs text-slate-500">{group.entries.length} update(s)</p>
                </div>
                <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${collapsed ? "" : "rotate-180"}`} />
              </button>
              {!collapsed && (
                <ol className="space-y-4 border-t border-slate-100 px-5 py-4">
                  {group.entries.map((entry) => renderHistoryEntry(entry))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Daily check-in"
          description="Log how you're feeling and any new symptoms. We'll update your guidance instantly."
        >
          <form onSubmit={handleCheckinSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Mood today
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  value={checkinForm.mood}
                  onChange={(event) => setCheckinForm((prev) => ({ ...prev, mood: event.target.value }))}
                >
                  <option value="">Select mood</option>
                  {moodOptions.map((mood) => (
                    <option key={mood} value={mood}>
                      {mood}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Symptoms
                <input
                  value={checkinForm.symptoms}
                  onChange={(event) => setCheckinForm((prev) => ({ ...prev, symptoms: event.target.value }))}
                  placeholder="e.g. headache, fatigue"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
                <span className="text-xs font-normal text-slate-500">Separate with commas.</span>
              </label>
            </div>
            <label className="text-sm font-semibold text-slate-700">
              Notes
              <textarea
                value={checkinForm.note}
                onChange={(event) => setCheckinForm((prev) => ({ ...prev, note: event.target.value }))}
                className="mt-1 min-h-[100px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Share anything new about symptoms, meds, or routines."
              />
            </label>
            <div className="grid gap-4 md:grid-cols-5">
              <Input
                label="Systolic"
                value={checkinForm.bpSystolic}
                onChange={(event) => setCheckinForm((prev) => ({ ...prev, bpSystolic: event.target.value }))}
                placeholder="120"
              />
              <Input
                label="Diastolic"
                value={checkinForm.bpDiastolic}
                onChange={(event) => setCheckinForm((prev) => ({ ...prev, bpDiastolic: event.target.value }))}
                placeholder="80"
              />
              <Input
                label="Heart rate"
                value={checkinForm.heartRate}
                onChange={(event) => setCheckinForm((prev) => ({ ...prev, heartRate: event.target.value }))}
                placeholder="72"
              />
              <Input
                label="Temperature °C"
                value={checkinForm.temperature}
                onChange={(event) => setCheckinForm((prev) => ({ ...prev, temperature: event.target.value }))}
                placeholder="36.8"
              />
              <Input
                label="SpO₂ %"
                value={checkinForm.spo2}
                onChange={(event) => setCheckinForm((prev) => ({ ...prev, spo2: event.target.value }))}
                placeholder="98"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={createCheckin.isPending} icon={<Activity className="h-4 w-4" />}>
                Log check-in
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Preferences"
          description="Adjust AI permissions and reminders."
          className="space-y-4"
        >
          {profileQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          )}
          {!profileQuery.isLoading && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={profileForm.consentAi}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, consentAi: event.target.checked }))}
                />
                <span className="text-sm text-slate-700">Allow AI to personalize my guidance</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={profileForm.consentData}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, consentData: event.target.checked }))}
                />
                <span className="text-sm text-slate-700">Share summaries with matched providers</span>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Primary goals
                <textarea
                  value={profileForm.primaryGoals}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, primaryGoals: event.target.value }))}
                  className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  placeholder="e.g. Manage blood pressure, improve sleep..."
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Notification channel
                <select
                  value={profileForm.notificationChannel}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, notificationChannel: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  <option value="push">In-app reminders</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Quiet hours
                <input
                  value={profileForm.quietHours}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, quietHours: event.target.value }))}
                  placeholder="e.g. 22:00-07:00"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </label>
              <div className="flex justify-end">
                <Button type="submit" loading={updateProfile.isPending} icon={<NotebookPen className="h-4 w-4" />}>
                  Save preferences
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <Card
        title="Personalized guidance"
        description={
          latestCheckin?.checkedAt
            ? `Updated ${formatRelative(latestCheckin.checkedAt)}`
            : "Log a check-in to receive your first insight."
        }
        badge={latestCheckin?.aiRiskLevel ? `Risk: ${latestCheckin.aiRiskLevel}` : undefined}
      >
        {renderRecommendation()}
      </Card>

      <Card
        title="Recent check-ins"
        description="Track your symptoms, vitals, and how guidance evolves."
        badge={`${checkinsQuery.data?.length ?? 0} entries`}
      >
        {renderHistory()}
      </Card>
    </div>
  );
};

export default SelfCarePage;
