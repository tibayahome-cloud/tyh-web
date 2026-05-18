import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Activity,
  Stethoscope,
  History,
  Heart,
  TrendingUp,
  Frown,
  Meh,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import classNames from "classnames";

import { Spinner } from "../../../shared/components/Spinner";
import { useToast } from "../../../shared/components/ToastProvider";
import {
  useSelfCareProfile,
  useSelfCareCheckins,
  useCreateSelfCareCheckinMutation,
  useUpdateSelfCareProfileMutation
} from "../../../shared/hooks/useSelfCare";
import type { SelfCareCheckin, SelfCareProfile } from "../../../shared/schemas/selfcare";
import { AppLayout } from "../../../shared/components/AppLayout";
import { ClientPageHeader } from "../components/ClientPageHeader";

const moodOptions = [
  { label: "steady", Icon: Meh, color: "text-blue-500", bg: "bg-blue-50" },
  { label: "low", Icon: Frown, color: "text-slate-400", bg: "bg-slate-50" },
  { label: "anxious", Icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50" },
  { label: "energized", Icon: Zap, color: "text-brand-600", bg: "bg-brand-50" },
  { label: "exhausted", Icon: Clock, color: "text-indigo-400", bg: "bg-indigo-50" },
];

const riskTone: Record<string, { bg: string, text: string, iconColor: string }> = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700", iconColor: "text-emerald-500" },
  moderate: { bg: "bg-amber-50", text: "text-amber-700", iconColor: "text-amber-500" },
  high: { bg: "bg-orange-50", text: "text-orange-700", iconColor: "text-orange-500" },
  emergency: { bg: "bg-rose-50", text: "text-rose-700", iconColor: "text-rose-500" }
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "Just now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatRelative = (iso?: string | null) => {
  if (!iso) return "moments ago";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "moments ago";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "moments ago";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const RiskBadge = ({ risk, compact = false }: { risk?: string | null, compact?: boolean }) => {
  const label = (risk ?? "moderate").toLowerCase();
  const config = riskTone[label] ?? riskTone.moderate;

  if (compact) {
    return (
      <div className={classNames("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", config.bg, config.text)}>
        <Activity size={10} className={config.iconColor} />
        {label}
      </div>
    );
  }

  return (
    <div className={classNames("flex items-center gap-3 px-4 py-2 rounded-2xl ring-1 ring-inset transition-all", config.bg, config.text, "ring-black/5 shadow-sm")}>
      <Activity size={16} className={config.iconColor} />
      <span className="text-[11px] font-black uppercase tracking-[0.2em]">{label} Risk</span>
    </div>
  );
};

type ProfileFormState = {
  consentAi: boolean;
  consentData: boolean;
  primaryGoals: string;
  notificationChannel: string;
  quietHours: string;
};

const buildProfileFormState = (profile?: SelfCareProfile | null): ProfileFormState => ({
  consentAi: profile?.consentAi ?? false,
  consentData: profile?.consentDataSharing ?? false,
  primaryGoals: profile?.primaryGoals ?? "",
  notificationChannel: profile?.preferences?.notification_channel ?? "push",
  quietHours: profile?.preferences?.quiet_hours ?? ""
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
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
};

const formatDateLabel = (key: string) => {
  if (key === "unknown") return "Undated entries";
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Undated entries";
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
    const entries = (checkinsQuery.data ?? []);
    const map = new Map<string, SelfCareCheckin[]>();
    entries.forEach((entry) => {
      const key = buildDateKey(entry.checkinAt);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .map(([key, list]) => ({
        key,
        label: formatDateLabel(key),
        entries: list.sort((a, b) => {
          const left = new Date(a.checkinAt || 0).getTime();
          const right = new Date(b.checkinAt || 0).getTime();
          return right - left;
        })
      }))
      .sort((a, b) => {
        if (a.key === "unknown") return 1;
        if (b.key === "unknown") return -1;
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
        showToast({ title: "Preferences updated", variant: "success" });
      })
      .catch((error: Error) => {
        showToast({ title: "Unable to save", description: error.message, variant: "error" });
      });
  };

  const handleCheckinSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const vitals = {
      bpSystolic: checkinForm.bpSystolic ? Number(checkinForm.bpSystolic) : undefined,
      bpDiastolic: checkinForm.bpDiastolic ? Number(checkinForm.bpDiastolic) : undefined,
      heartRate: checkinForm.heartRate ? Number(checkinForm.heartRate) : undefined,
      temperature: checkinForm.temperature ? Number(checkinForm.temperature) : undefined,
      oxygenLevel: checkinForm.spo2 ? Number(checkinForm.spo2) : undefined
    };
    createCheckin
      .mutateAsync({
        mood: checkinForm.mood || undefined,
        notes: checkinForm.note || undefined,
        symptoms: checkinForm.symptoms.split(/[,]/).map((e) => e.trim()).filter(Boolean),
        vitals
      })
      .then(() => {
        showToast({ title: "Logged successfully", variant: "success" });
        setCheckinForm(initialCheckinState);
      })
      .catch((error: Error) => {
        showToast({ title: "Submission failed", description: error.message, variant: "error" });
      });
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="flex flex-col gap-4 pb-32">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <h1 className="type-h2 text-slate-900">Self-Care Hub</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 px-4 sm:px-6 lg:px-8 relative z-20">
          {/* LEFT COLUMN: GUIDANCE & HISTORY */}
          <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">
            {/* HEALTH RECOMMENDATIONS */}
            <section className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100 p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Personalized Guidance</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {latestCheckin?.checkinAt
                      ? `Updated ${formatRelative(latestCheckin.checkinAt)}`
                      : "Log an update to see guidance."}
                  </p>
                </div>
                {latestCheckin?.recommendation && <RiskBadge risk={latestCheckin.recommendation.riskLevel} />}
              </div>

              {!latestCheckin?.recommendation ? (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <div className="h-12 w-12 rounded-lg bg-white shadow-lg flex items-center justify-center text-brand-600 mb-3">
                    <Stethoscope size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Your first insight is waiting</h3>
                  <p className="mt-2 text-xs text-slate-500 max-w-xs mx-auto">
                    Share how you feel today using the check-in tool to unlock guidance.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-brand-linear text-white shadow-md relative group overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white">
                      <TrendingUp size={16} />
                    </div>
                    <h4 className="text-xs text-white/60 mb-1 font-bold uppercase">Insight</h4>
                    <p className="text-sm font-bold text-white leading-tight line-clamp-2">
                      {latestCheckin.recommendation.summary}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(latestCheckin.recommendation.steps ?? []).map((step, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-white ring-1 ring-slate-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-all">
                            <CheckCircle2 size={16} />
                          </div>
                          <h5 className="text-xs font-bold text-slate-900">{step.title}</h5>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                          {step.description}
                        </p>
                        {step.timeframe && (
                          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-1">
                            <Clock size={10} className="text-slate-400" />
                            <p className="text-[8px] text-slate-400 uppercase">{step.timeframe}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-rose-50/50 border border-rose-100">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                      <h4 className="text-xs font-bold text-rose-900">When to seek help</h4>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {(latestCheckin.recommendation.whenToSeekHelp ?? []).map((item, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <div className="h-1 w-1 rounded-full bg-rose-300 mt-1.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.trigger}</p>
                            <p className="text-xs text-slate-500 leading-snug">{item.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* HISTORY TIMELINE */}
            <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-100 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900">Health History</h2>
                <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-brand-600">
                  <History size={16} />
                </div>
              </div>

              {groupedCheckins.length === 0 ? (
                <div className="py-8 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">No activity logged yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedCheckins.map((group) => {
                    const collapsed = collapsedGroups[group.key] ?? false;
                    return (
                      <div key={group.key} className="relative">
                        <button
                          onClick={() => toggleGroup(group.key)}
                          className={classNames(
                            "w-full flex items-center justify-between p-3 rounded-lg transition-all",
                            collapsed
                              ? "bg-slate-50/50 text-slate-400"
                              : "bg-white shadow-sm ring-1 ring-slate-100"
                          )}
                        >
                          <div className="flex items-center gap-2 text-left">
                            <div className={classNames(
                              "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                              collapsed ? "bg-slate-100 text-slate-400" : "bg-brand-50 text-brand-600"
                            )}>
                              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{group.label}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{group.entries.length} record(s)</p>
                            </div>
                          </div>
                        </button>
                        {!collapsed && (
                          <div className="mt-3 ml-3 pl-6 border-l-2 border-slate-100 space-y-3 pb-2">
                            {group.entries.map((entry) => (
                              <div key={entry.id} className="relative group">
                                <div className="absolute -left-[23px] top-3 h-3 w-3 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-50 shadow-sm" />
                                <div className="p-3 rounded-lg bg-white shadow-sm ring-1 ring-slate-100 hover:shadow-md transition-all">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] text-slate-400">
                                      {formatDateTime(entry.checkinAt).split(",")[1]}
                                    </p>
                                    <RiskBadge risk={entry.aiRiskLevel} compact />
                                  </div>

                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {entry.mood && (
                                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 text-slate-600 text-[9px] font-bold">
                                        Mood: {moodOptions.find(m => m.label === entry.mood)?.label ?? entry.mood}
                                      </div>
                                    )}
                                    {entry.symptoms && entry.symptoms.length > 0 && (
                                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-50 text-brand-700 text-[9px] font-bold">
                                        {entry.symptoms.length} Symptoms
                                      </div>
                                    )}
                                  </div>

                                  {entry.notes && (
                                    <blockquote className="text-xs text-slate-600 bg-slate-50/50 p-2 rounded-lg border-l-2 border-brand-200 italic mb-2">
                                      "{entry.notes.substring(0, 50)}..."
                                    </blockquote>
                                  )}

                                  {entry.vitals && (entry.vitals.bpSystolic || entry.vitals.bpDiastolic) && (
                                    <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-50">
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-6 w-6 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                                          <Activity size={12} />
                                        </div>
                                        <div>
                                          <p className="text-[8px] text-slate-400">BP</p>
                                          <p className="text-xs font-bold text-slate-900">{entry.vitals.bpSystolic}/{entry.vitals.bpDiastolic}</p>
                                        </div>
                                      </div>
                                      {entry.vitals.heartRate && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                            <Heart size={12} />
                                          </div>
                                          <div>
                                            <p className="text-[8px] text-slate-400">HR</p>
                                            <p className="text-xs font-bold text-slate-900">{entry.vitals.heartRate}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN: FORMS & PREFS */}
          <div className="lg:col-span-4 space-y-8 order-1 lg:order-2">
            {/* CHECK-IN FORM */}
            <section className="rounded-[2.5rem] bg-white shadow-card ring-1 ring-slate-100 overflow-hidden">
              <div className="p-10 pb-4">
                <p className="type-overline text-brand-600">Action Center</p>
                <h2 className="type-h2 text-slate-900">Daily Health Puls</h2>
                <p className="type-caption text-slate-500 mt-2 font-medium">Updates your guidance score instantly.</p>
              </div>

              <form onSubmit={handleCheckinSubmit} className="p-10 space-y-10">
                {/* MOOD SELECTION */}
                <div className="space-y-5">
                  <p className="type-overline text-slate-400 pl-1">Overall Mood</p>
                  <div className="flex gap-3">
                    {moodOptions.map(({ label, Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setCheckinForm(p => ({ ...p, mood: label }))}
                        className={classNames(
                          "flex-1 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all",
                          checkinForm.mood === label
                            ? "bg-slate-900 text-white shadow-elevated scale-110"
                            : "bg-slate-50 text-slate-400 border border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <Icon size={24} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <p className="type-overline text-slate-400 pl-1">Current Symptoms</p>
                    <input
                      value={checkinForm.symptoms}
                      onChange={(e) => setCheckinForm(p => ({ ...p, symptoms: e.target.value }))}
                      placeholder="e.g. Cough, Muscle Pain"
                      className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-100 px-6 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-600/10 focus:border-brand-600/20 shadow-inner"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="type-overline text-slate-400 pl-1">Detailed Observation</p>
                    <textarea
                      value={checkinForm.note}
                      onChange={(e) => setCheckinForm(p => ({ ...p, note: e.target.value }))}
                      placeholder="How was your sleep or appetite?"
                      className="w-full min-h-[140px] rounded-2xl bg-slate-50 border border-slate-100 p-6 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-600/10 focus:border-brand-600/20 shadow-inner resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="type-overline text-slate-400 pl-1">Vitals (Optional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="type-overline text-slate-300 text-[8px] pl-1">BP Sys</p>
                      <input
                        placeholder="120"
                        value={checkinForm.bpSystolic}
                        onChange={(e) => setCheckinForm(p => ({ ...p, bpSystolic: e.target.value }))}
                        className="w-full h-12 rounded-xl bg-slate-50 border border-slate-100 px-5 type-body font-bold shadow-inner"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="type-overline text-slate-300 text-[8px] pl-1">Heart Rate</p>
                      <input
                        placeholder="72"
                        value={checkinForm.heartRate}
                        onChange={(e) => setCheckinForm(p => ({ ...p, heartRate: e.target.value }))}
                        className="w-full h-12 rounded-xl bg-slate-50 border border-slate-100 px-5 type-body font-bold shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createCheckin.isPending}
                  className="w-full h-16 rounded-[2rem] bg-slate-900 text-white type-caption font-black uppercase tracking-widest shadow-elevated transition-all hover:bg-brand-600 active:scale-95 flex items-center justify-center gap-3"
                >
                  {createCheckin.isPending ? <Spinner className="w-6 h-6 text-white" /> : (
                    <>
                      <Plus size={20} />
                      Log Check-in
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* PREFERENCES */}
            <section className="rounded-[2.5rem] bg-slate-900 shadow-elevated p-10 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-linear opacity-20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />

              <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white ring-1 ring-white/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="type-h3 text-white">Security & Privacy</h3>
                  <p className="type-overline text-white/40">AI-Controlled Space</p>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-8 relative z-10">
                <label className="flex items-center justify-between group cursor-pointer">
                  <span className="type-caption font-bold text-white/70 group-hover:text-white transition-colors">Personalize Guidance</span>
                  <div className={classNames(
                    "h-7 w-12 rounded-full transition-all flex items-center px-1 shadow-inner",
                    profileForm.consentAi ? "bg-brand-600" : "bg-white/10"
                  )}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={profileForm.consentAi}
                      onChange={(e) => setProfileForm(p => ({ ...p, consentAi: e.target.checked }))}
                    />
                    <div className={classNames(
                      "h-5 w-5 rounded-full bg-white transition-all shadow-xl",
                      profileForm.consentAi ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                </label>

                <label className="flex items-center justify-between group cursor-pointer">
                  <span className="type-caption font-bold text-white/70 group-hover:text-white transition-colors">Shared Provider Sync</span>
                  <div className={classNames(
                    "h-7 w-12 rounded-full transition-all flex items-center px-1 shadow-inner",
                    profileForm.consentData ? "bg-brand-600" : "bg-white/10"
                  )}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={profileForm.consentData}
                      onChange={(e) => setProfileForm(p => ({ ...p, consentData: e.target.checked }))}
                    />
                    <div className={classNames(
                      "h-5 w-5 rounded-full bg-white transition-all shadow-xl",
                      profileForm.consentData ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                </label>

                <div className="space-y-3">
                  <p className="type-overline text-white/30 pl-1">Primary Health Goals</p>
                  <textarea
                    value={profileForm.primaryGoals}
                    onChange={(e) => setProfileForm(p => ({ ...p, primaryGoals: e.target.value }))}
                    placeholder="e.g. Improved mobility, better sleep"
                    className="w-full min-h-[100px] rounded-2xl bg-white/5 border border-white/10 p-5 type-body text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-brand-600/50 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-14 rounded-2xl bg-white text-slate-900 type-caption font-black uppercase tracking-widest transition-all hover:bg-brand-600 hover:text-white active:scale-95"
                >
                  Save Securely
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SelfCarePage;
