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
      <div className="flex flex-col gap-8 pb-32">
        {/* HERO HEADER */}
        <section className="relative -mx-4 -mt-12 overflow-hidden px-4 pb-16 pt-16 sm:-mx-8 sm:px-8">
          <div className="absolute inset-0 bg-brand-linear opacity-90" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/20 blur-3xl rounded-full translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Personal Health Space</p>
              <h1 className="text-4xl font-black text-white leading-tight">
                Care Hub <br />
                <span className="text-white/70">Monitoring & Recovery</span>
              </h1>
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 text-white text-[10px] font-bold">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  Privacy Shield Active
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 text-white text-[10px] font-bold">
                  <Sparkles size={14} className="text-amber-400" />
                  AI-Powered Insights
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-12 -mt-10 px-4 sm:px-0">
          {/* LEFT COLUMN: GUIDANCE & HISTORY */}
          <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">
            {/* PERSONALIZED GUIDANCE */}
            <section className="relative overflow-hidden rounded-[40px] border border-slate-100 bg-white shadow-2xl p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-brand-600" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-600">Smart Advice</p>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Health Recommendations</h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {latestCheckin?.checkinAt
                      ? `Updated ${formatRelative(latestCheckin.checkinAt)} based on your last check-in.`
                      : "Log an update to see your personalized guidance."}
                  </p>
                </div>
                {latestCheckin?.recommendation && <RiskBadge risk={latestCheckin.recommendation.riskLevel} />}
              </div>

              {!latestCheckin?.recommendation ? (
                <div className="py-20 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-[32px] border border-dashed border-slate-200">
                  <div className="h-20 w-20 rounded-3xl bg-white shadow-xl flex items-center justify-center text-brand-600 mb-6 transition-transform hover:scale-110">
                    <Stethoscope size={40} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Your first insight is waiting</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500 max-w-xs mx-auto">
                    Share how you feel today using the check-in tool to unlock clinical guidance.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="p-8 rounded-[32px] bg-brand-50/50 border border-brand-100 relative group transition-all hover:bg-brand-50">
                    <div className="absolute top-6 right-6 h-12 w-12 rounded-2xl bg-white shadow flex items-center justify-center text-brand-600">
                      <TrendingUp size={24} />
                    </div>
                    <h4 className="text-xs font-black text-brand-600 uppercase tracking-widest mb-2">Priority Insight</h4>
                    <p className="text-xl font-black text-slate-900 leading-tight">
                      {latestCheckin.recommendation.summary}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {(latestCheckin.recommendation.steps ?? []).map((step, idx: number) => (
                      <div key={idx} className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all">
                            <CheckCircle2 size={20} />
                          </div>
                          <h5 className="text-sm font-black text-slate-900">{step.title}</h5>
                        </div>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed">
                          {step.description}
                        </p>
                        {step.timeframe && (
                          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                            <Clock size={12} className="text-slate-400" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{step.timeframe}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-8 rounded-[32px] bg-rose-50/50 border border-rose-100">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle size={20} className="text-rose-500" />
                      <h4 className="text-xs font-black text-rose-900 uppercase tracking-widest">Protocol: When to seek help</h4>
                    </div>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {(latestCheckin.recommendation.whenToSeekHelp ?? []).map((item, idx: number) => (
                        <li key={idx} className="flex gap-4">
                          <div className="h-1.5 w-1.5 rounded-full bg-rose-300 mt-2 shrink-0" />
                          <div>
                            <p className="text-xs font-black text-slate-900 mb-0.5">{item.trigger}</p>
                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{item.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* HISTORY TIMELINE */}
            <section className="rounded-[40px] border border-slate-100 bg-white/50 backdrop-blur-xl shadow-xl p-8 sm:p-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Activity Log</p>
                  <h2 className="text-2xl font-black text-slate-900">Health History</h2>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-brand-600">
                  <History size={24} />
                </div>
              </div>

              {groupedCheckins.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-slate-400">No logs found. Consistency is key to recovery!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedCheckins.map((group) => {
                    const collapsed = collapsedGroups[group.key] ?? false;
                    return (
                      <div key={group.key} className="relative">
                        <button
                          onClick={() => toggleGroup(group.key)}
                          className={classNames(
                            "w-full flex items-center justify-between p-6 rounded-[32px] transition-all",
                            collapsed ? "bg-white/40 grayscale" : "bg-white shadow-xl ring-1 ring-slate-100"
                          )}
                        >
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                              {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 uppercase tracking-widest">{group.label}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">{group.entries.length} log points</p>
                            </div>
                          </div>
                        </button>
                        {!collapsed && (
                          <div className="mt-4 ml-6 pl-10 border-l-2 border-slate-100 space-y-6 pb-4">
                            {group.entries.map((entry) => (
                              <div key={entry.id} className="relative group">
                                <div className="absolute -left-[51px] top-4 h-5 w-5 rounded-full border-4 border-white bg-brand-600 ring-4 ring-brand-50 shadow-sm" />
                                <div className="p-6 rounded-[32px] bg-white shadow-sm ring-1 ring-slate-100 hover:shadow-xl transition-all">
                                  <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                      {formatDateTime(entry.checkinAt).split(",")[1]}
                                    </p>
                                    <RiskBadge risk={entry.aiRiskLevel} compact />
                                  </div>

                                  {entry.mood && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest mb-4">
                                      {moodOptions.find(m => m.label === entry.mood)?.label ?? entry.mood}
                                    </div>
                                  )}

                                  {entry.notes && (
                                    <p className="text-sm font-medium text-slate-600 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 italic">
                                      "{entry.notes}"
                                    </p>
                                  )}

                                  {entry.vitals?.bpSystolic && (
                                    <div className="mt-4 flex flex-wrap gap-4">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Activity size={14} /></div>
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase">Blood Pressure</p>
                                          <p className="text-xs font-black text-slate-900">{entry.vitals.bpSystolic}/{entry.vitals.bpDiastolic}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center"><Heart size={14} /></div>
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase">Heart Rate</p>
                                          <p className="text-xs font-black text-slate-900">{entry.vitals.heartRate} BPM</p>
                                        </div>
                                      </div>
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
            <section className="rounded-[40px] border border-slate-100 bg-white shadow-2xl overflow-hidden">
              <div className="p-8 pb-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-600">Action Center</p>
                <h2 className="text-2xl font-black text-slate-900">Daily Pulse check</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Updates your guidance score instantly.</p>
              </div>

              <form onSubmit={handleCheckinSubmit} className="p-8 space-y-8">
                {/* MOOD SELECTION */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Overall Mood</p>
                  <div className="flex gap-2">
                    {moodOptions.map(({ label, Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setCheckinForm(p => ({ ...p, mood: label }))}
                        className={classNames(
                          "flex-1 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all",
                          checkinForm.mood === label
                            ? "bg-brand-linear text-white shadow-xl scale-110 ring-2 ring-white"
                            : "bg-slate-50 text-slate-400 grayscale border border-slate-100"
                        )}
                      >
                        <Icon size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Symptoms</p>
                    <input
                      value={checkinForm.symptoms}
                      onChange={(e) => setCheckinForm(p => ({ ...p, symptoms: e.target.value }))}
                      placeholder="e.g. Cough, Muscle Pain"
                      className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-100 px-6 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-600/20 shadow-inner"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Detailed Observation</p>
                    <textarea
                      value={checkinForm.note}
                      onChange={(e) => setCheckinForm(p => ({ ...p, note: e.target.value }))}
                      placeholder="Any changes in appetite or sleep?"
                      className="w-full min-h-[120px] rounded-2xl bg-slate-50 border border-slate-100 p-6 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-600/20 shadow-inner resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Vitals (Optional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="BP Sys (120)"
                      value={checkinForm.bpSystolic}
                      onChange={(e) => setCheckinForm(p => ({ ...p, bpSystolic: e.target.value }))}
                      className="h-14 rounded-2xl bg-slate-50 border border-slate-100 px-5 text-xs font-black shadow-inner"
                    />
                    <input
                      placeholder="Heart Rate"
                      value={checkinForm.heartRate}
                      onChange={(e) => setCheckinForm(p => ({ ...p, heartRate: e.target.value }))}
                      className="h-14 rounded-2xl bg-slate-50 border border-slate-100 px-5 text-xs font-black shadow-inner"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createCheckin.isPending}
                  className="w-full h-16 rounded-3xl bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all hover:bg-brand-600 active:scale-95 flex items-center justify-center gap-3"
                >
                  {createCheckin.isPending ? <Spinner className="w-5 h-5 text-white" /> : (
                    <>
                      <Plus size={18} />
                      Submit Review
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* PREFERENCES */}
            <section className="rounded-[40px] border border-slate-100 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="text-xl font-black text-white">Security & AI</h3>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <label className="flex items-center gap-4 group cursor-pointer">
                  <div className={classNames(
                    "h-6 w-11 rounded-full transition-all flex items-center px-1 shadow-inner",
                    profileForm.consentAi ? "bg-brand-600" : "bg-white/10"
                  )}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={profileForm.consentAi}
                      onChange={(e) => setProfileForm(p => ({ ...p, consentAi: e.target.checked }))}
                    />
                    <div className={classNames(
                      "h-4 w-4 rounded-full bg-white transition-all shadow-xl",
                      profileForm.consentAi ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">Personalize Guidance</span>
                </label>

                <label className="flex items-center gap-4 group cursor-pointer">
                  <div className={classNames(
                    "h-6 w-11 rounded-full transition-all flex items-center px-1 shadow-inner",
                    profileForm.consentData ? "bg-brand-600" : "bg-white/10"
                  )}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={profileForm.consentData}
                      onChange={(e) => setProfileForm(p => ({ ...p, consentData: e.target.checked }))}
                    />
                    <div className={classNames(
                      "h-4 w-4 rounded-full bg-white transition-all shadow-xl",
                      profileForm.consentData ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">Shared Provider Sync</span>
                </label>

                <div className="space-y-2 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30 pl-1">Primary Health Goals</p>
                  <textarea
                    value={profileForm.primaryGoals}
                    onChange={(e) => setProfileForm(p => ({ ...p, primaryGoals: e.target.value }))}
                    placeholder="e.g. Improved mobility, pain management"
                    className="w-full min-h-[80px] rounded-2xl bg-white/5 border border-white/10 p-4 text-xs font-medium text-white placeholder-white/20 focus:outline-none transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-14 rounded-2xl bg-white text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-brand-600 hover:text-white active:scale-95"
                >
                  Save Preferences
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
