import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Rocket,
  Files,
  UserCircle2,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Activity,
  Clock
} from "lucide-react";
import classNames from "classnames";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import { Modal } from "../../../shared/components/Modal";
import { Stepper } from "../../../shared/components/Stepper";
import { StickyActionBar } from "../../../shared/components/StickyActionBar";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useProviderProfile } from "../hooks/useProviderProfile";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, provApp, reqType } from "../../../shared/libs/fieldInclude";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../shared/components/ToastProvider";
import { useProviderOnboardingStore } from "../store/useProviderOnboardingStore";
import { useSocket } from "../../../shared/hooks/useSocket";

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200";

type Requirement = {
  id: string;
  key: string;
  label: string;
  input_type: "file" | "image" | "text";
  is_universal: boolean;
  is_sensitive: boolean;
  display_order?: number | null;
};

type RequirementItem = {
  id: string;
  status: string;
  value_text?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  comment?: string | null;
  requirement_type?: Requirement;
  requirement_id?: string;
};

type ProviderApplication = {
  id: string;
  status: string;
  notes?: string | null;
  items?: RequirementItem[];
  progress_percent?: number | null;
};

type Envelope<T> = {
  data: T;
};

const steps = [
  { title: "Mission Portal", description: "Getting started", icon: <Rocket className="h-4 w-4" /> },
  { title: "Identity", description: "Provider details", icon: <UserCircle2 className="h-4 w-4" /> },
  { title: "Verification", description: "Documents", icon: <Files className="h-4 w-4" /> },
  { title: "Ready for Launch", description: "Review & Submit", icon: <ShieldCheck className="h-4 w-4" /> }
];

const useRequirementsQuery = () =>
  useQuery({
    queryKey: ["provider", "requirements"],
    queryFn: async () => {
      const response = await api.get<Envelope<Requirement[]>>("/provider-requirements", {
        params: buildFieldParams(reqType)
      });
      return response.data.data;
    }
  });

const useApplicationQuery = () =>
  useQuery({
    queryKey: ["provider", "application"],
    queryFn: async () => {
      try {
        const response = await api.get<Envelope<ProviderApplication>>("/provider-applications/me", {
          params: buildFieldParams(provApp)
        });
        return response.data.data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    refetchOnWindowFocus: false
  });

const OnboardingPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: requirements, isPending: loadingRequirements } = useRequirementsQuery();
  const applicationQuery = useApplicationQuery();
  const { data: application, isPending: loadingApplication, isFetching, refetch: refetchApplication } = applicationQuery;
  const { data: profile } = useProviderProfile(user?.id);
  const socket = useSocket();
  const [previewItem, setPreviewItem] = useState<RequirementItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const {
    currentStep,
    setStep,
    documentDrafts,
    setDocumentDraft,
    clearDocumentDraft,
    profileDraft,
    setProfileDraft,
    clearProfileDraft
  } =
    useProviderOnboardingStore();

  useEffect(() => {
    if (!application && currentStep !== 0) {
      setStep(0);
    }
  }, [application, currentStep, setStep]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    const needsHydration =
      profileDraft.dailyRequestLimit === undefined && profileDraft.canEmergency === undefined;
    if (needsHydration) {
      setProfileDraft({
        dailyRequestLimit: profile.daily_request_limit ?? 0,
        canEmergency: profile.can_emergency ?? false
      });
    }
  }, [profile, profileDraft.dailyRequestLimit, profileDraft.canEmergency, setProfileDraft]);

  useEffect(() => {
    if (!socket || !user?.id) {
      return;
    }

    const handleNotification = (payload: { user_id?: string; event_key?: string; data?: Record<string, unknown> }) => {
      if (payload?.user_id !== user.id) {
        return;
      }
      if (payload.event_key === "provider.application.resubmission_requested") {
        toast.showToast({
          title: "More information needed",
          description: "Please review the updated checklist items.",
          variant: "info"
        });
        setStep(2);
        refetchApplication();
      }
      if (payload.event_key === "provider.application.requirement_added") {
        toast.showToast({
          title: "New requirement added",
          description: "We added a new requirement to your application.",
          variant: "info"
        });
        setStep(2);
        refetchApplication();
      }
    };

    const handleBootstrap = (payload: { user_id?: string }) => {
      if (payload?.user_id === user.id) {
        refetchApplication();
        queryClient.invalidateQueries({ queryKey: ["provider", "requirements"] });
      }
    };

    socket.on("notification.created", handleNotification);
    socket.on("model.provider.onboarding.bootstrap", handleBootstrap);

    return () => {
      socket.off("notification.created", handleNotification);
      socket.off("model.provider.onboarding.bootstrap", handleBootstrap);
    };
  }, [socket, user?.id, toast, queryClient, refetchApplication, setStep]);

  useEffect(() => {
    if (!application) {
      return;
    }
    if (application.status === "under_review") {
      setStep(2);
    } else if (application.status === "approved") {
      setStep(3);
    }
  }, [application?.status, setStep, application]);

  const createApplicationMutation = useMutation({
    mutationFn: async () => {
      await api.post("/provider-applications", {});
    },
    onSuccess: () => {
      toast.showToast({
        title: "Application created",
        description: "We’ve prepared the onboarding checklist.",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["provider", "application"] });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to create application",
        description: error instanceof Error ? error.message : "Please try again shortly.",
        variant: "error"
      });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { daily_request_limit: number; can_emergency: boolean }) => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      await api.patch(`/providers/${user.id}`, payload);
    },
    onSuccess: () => {
      toast.showToast({
        title: "Profile updated",
        description: "We saved your provider details.",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["provider", "profile", user?.id] });
      clearProfileDraft();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      item,
      payload,
      requirementId
    }: {
      item: RequirementItem;
      payload: Record<string, unknown>;
      requirementId: string;
    }) => {
      if (!application) {
        throw new Error("Application missing");
      }
      await api.put(`/provider-applications/${application.id}/items/${item.id}`, payload);
      return requirementId;
    },
    onSuccess: (requirementId) => {
      useProviderOnboardingStore.getState().clearDocumentDraft(requirementId);
      queryClient.invalidateQueries({ queryKey: ["provider", "application"] });
      toast.showToast({
        title: "Saved",
        description: "Your update is stored.",
        variant: "success"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to save",
        description: error instanceof Error ? error.message : "Try again later.",
        variant: "error"
      });
    }
  });

  const uploadItemFileMutation = useMutation({
    mutationFn: async ({ itemId, file }: { itemId: string; file: File; requirementId: string }) => {
      if (!application) {
        throw new Error("Application missing");
      }
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/provider-applications/${application.id}/items/${itemId}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: (_, { requirementId }) => {
      if (requirementId) {
        useProviderOnboardingStore.getState().clearDocumentDraft(requirementId);
      }
      queryClient.invalidateQueries({ queryKey: ["provider", "application"] });
      toast.showToast({
        title: "File uploaded",
        description: "We received your document.",
        variant: "success"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!application) {
        throw new Error("Application missing");
      }
      await api.post(`/provider-applications/${application.id}/submit`, {});
    },
    onSuccess: () => {
      toast.showToast({
        title: "Application submitted",
        description: "We’ll review and notify you soon.",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["provider", "application"] });
      useProviderOnboardingStore.getState().reset();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please review your responses and try again.",
        variant: "error"
      });
    }
  });

  const itemsByRequirement = useMemo(() => {
    if (!application?.items) {
      return {} as Record<string, RequirementItem>;
    }
    return application.items.reduce((acc, item) => {
      if (item.requirement_type?.id) {
        acc[item.requirement_type.id] = item;
      }
      return acc;
    }, {} as Record<string, RequirementItem>);
  }, [application]);

  const canSubmit = useMemo(() => {
    if (!application?.items || application.items.length === 0) {
      return false;
    }
    return application.items.every((item) => item.status && item.status !== "missing" && item.status !== "rejected");
  }, [application]);

  const renderOverview = () => {
    const totalRequirements = requirements?.length ?? 0;
    const completed = application?.items?.filter((item) => item.status === "verified" || item.status === "submitted") ?? [];
    const isReady = application && totalRequirements > 0;

    return (
      <div className="space-y-6">
        <Card
          className="relative overflow-hidden border-none bg-white p-10 shadow-xl ring-1 ring-black/5"
          title={<span className="text-2xl font-black text-slate-900">Pre-flight Briefing</span>}
          description="Ready to start your journey? Here is your verification roadmap."
        >
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-500/5 blur-3xl" />

          <div className="relative mt-8 grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-6">
              <div className="rounded-[32px] bg-slate-50/50 p-6 ring-1 ring-black/5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4">Mission Status</p>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-brand-600">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {totalRequirements > 0
                        ? `${completed.length} of ${totalRequirements} items verified`
                        : "Awaiting initialization"}
                    </p>
                    <p className="text-xs font-medium text-slate-500">Your application checklist progress.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] bg-slate-50/50 p-6 ring-1 ring-black/5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4">Verification Level</p>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-emerald-600">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">Standard Provider</p>
                    <p className="text-xs font-medium text-slate-500">Tier 1 access upon verification completion.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-6 rounded-[32px] bg-brand-linear p-8 text-white shadow-2xl shadow-brand-200">
              <div>
                <h4 className="text-xl font-black">Ready to Begin?</h4>
                <p className="mt-2 text-sm font-medium text-white/80 leading-relaxed">
                  Your clinical verification ensures the highest standard of care for our clients.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {application ? (
                  <Button
                    className="h-12 rounded-2xl bg-white text-brand-600 hover:bg-slate-50 shadow-xl"
                    onClick={() => setStep(1)}
                  >
                    Continue Verification
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="h-12 rounded-2xl bg-white text-brand-600 hover:bg-slate-50 shadow-xl"
                    onClick={() => createApplicationMutation.mutate()}
                    loading={createApplicationMutation.isPending}
                  >
                    Initialize Application
                    <Sparkles className="mr-2 h-4 w-4" />
                  </Button>
                )}
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/60">
                  Data encrypted & compliant
                </p>
              </div>
            </div>
          </div>
        </Card>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            { title: "Identity", icon: <UserCircle2 className="h-5 w-5" />, desc: "Professional credentials" },
            { title: "Compliance", icon: <Files className="h-5 w-5" />, desc: "Legal & medical records" },
            { title: "Review", icon: <ShieldCheck className="h-5 w-5" />, desc: "Final quality audit" }
          ].map((item) => (
            <div key={item.title} className="rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-[1.02]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                {item.icon}
              </div>
              <p className="text-sm font-black text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{item.desc}</p>
            </div>
          ))}
        </section>
      </div>
    );
  };

  const dailyLimitValue = profileDraft.dailyRequestLimit ?? profile?.daily_request_limit ?? 0;
  const canEmergencyValue = profileDraft.canEmergency ?? profile?.can_emergency ?? false;

  const renderProfileStep = () => (
    <Card
      className="relative overflow-hidden border-none bg-white p-10 shadow-xl ring-1 ring-black/5"
      title={<span className="text-2xl font-black text-slate-900">Provider Capacity</span>}
      description="Tell us how many requests you can manage and your emergency readiness."
    >
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-500/5 blur-3xl opacity-50" />

      <form
        className="relative mt-8 space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          const dailyLimit = Number(dailyLimitValue) || 0;
          const canEmergency = Boolean(canEmergencyValue);
          updateProfileMutation.mutate({
            daily_request_limit: dailyLimit,
            can_emergency: canEmergency
          });
        }}
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div className="group space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest" htmlFor="daily_request_limit">
              Daily Request Limit
            </label>
            <div className="relative">
              <input
                id="daily_request_limit"
                name="daily_request_limit"
                type="number"
                min={0}
                value={dailyLimitValue}
                onChange={(event) => {
                  const value = event.target.value;
                  const parsed = value === "" ? null : Number(value);
                  setProfileDraft({ dailyRequestLimit: parsed });
                }}
                className="h-14 w-full rounded-2xl border-none bg-slate-50 px-5 text-sm font-bold text-slate-900 shadow-inner ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. 10"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase tracking-widest">Tasks/Day</div>
            </div>
            <p className="text-[10px] font-medium text-slate-400 tracking-wide px-1">
              You can adjust this later in your profile settings.
            </p>
          </div>

          <div className="flex flex-col justify-end pb-1">
            <label className="group flex cursor-pointer items-start gap-4 rounded-[32px] border border-transparent bg-slate-50/50 p-6 transition-all hover:bg-white hover:shadow-lg hover:ring-1 hover:ring-black/5" htmlFor="can_emergency">
              <div className="relative flex h-6 w-6 shrink-0 items-center justify-center uppercase">
                <input
                  id="can_emergency"
                  name="can_emergency"
                  type="checkbox"
                  checked={Boolean(canEmergencyValue)}
                  onChange={(event) => setProfileDraft({ canEmergency: event.target.checked })}
                  className="peer h-6 w-6 rounded-lg border-slate-200 bg-white text-brand-600 shadow-sm transition-all focus:ring-brand-500 focus:ring-offset-0"
                />
                <div className="absolute inset-0 pointer-events-none rounded-lg ring-1 ring-black/5 transition-all peer-checked:ring-brand-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">Emergency Readiness</p>
                <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">
                  I am prepared to receive and respond to high-priority emergency alerts within my area.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-50">
          <Button
            type="submit"
            className="h-12 w-full md:w-auto rounded-2xl px-10 shadow-lg shadow-brand-100"
            loading={updateProfileMutation.isPending}
          >
            Save Provider Details
          </Button>
        </div>
      </form>
    </Card>
  );

  const statusBadge = (status: string) => {
    const palette: Record<string, { bg: string; text: string; ring: string; icon: React.ReactNode }> = {
      verified: {
        bg: "bg-emerald-50/50",
        text: "text-emerald-700",
        ring: "ring-emerald-600/20",
        icon: <CheckCircle2 className="h-3 w-3" />
      },
      pending: {
        bg: "bg-amber-50/50",
        text: "text-amber-700",
        ring: "ring-amber-600/20",
        icon: <Clock className="h-3 w-3" />
      },
      missing: {
        bg: "bg-slate-50/50",
        text: "text-slate-500",
        ring: "ring-slate-400/20",
        icon: <AlertCircle className="h-3 w-3" />
      },
      rejected: {
        bg: "bg-rose-50/50",
        text: "text-rose-700",
        ring: "ring-rose-600/20",
        icon: <AlertCircle className="h-3 w-3" />
      },
    };
    const normalized = (status || "missing").toLowerCase();
    const config = palette[normalized] ?? palette.pending;

    return (
      <div className={classNames(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset",
        config.bg,
        config.text,
        config.ring
      )}>
        {config.icon}
        {normalized.replace(/_/g, " ")}
      </div>
    );
  };

  const renderDocumentsStep = () => (
    <div className="space-y-6">
      <div className="grid gap-6">
        {(requirements ?? []).map((requirement) => {
          const item = itemsByRequirement[requirement.id];
          const draft = documentDrafts[requirement.id];
          const reviewerNote = item?.comment;
          const status = (item?.status ?? "missing").toLowerCase();
          const isText = requirement.input_type === "text";
          const textValue = (draft?.value ?? item?.value_text ?? "").toString();
          const stagedFile = draft?.file ?? null;

          const saveText = () => {
            if (!item) return;
            updateItemMutation.mutate({
              item,
              payload: { value_text: textValue, status: "pending" },
              requirementId: requirement.id
            });
          };

          const uploadFile = () => {
            if (!item || !stagedFile) return;
            uploadItemFileMutation.mutate({ itemId: item.id, file: stagedFile, requirementId: requirement.id });
          };

          return (
            <Card
              key={requirement.id}
              className="relative overflow-hidden border-none bg-white p-8 shadow-xl ring-1 ring-black/5"
              title={<span className="text-xl font-black text-slate-900">{requirement.label}</span>}
            >
              <div className="absolute right-0 top-0 p-8">
                {statusBadge(status)}
              </div>

              <div className="flex flex-col gap-8">
                {requirement.is_sensitive && (
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5">
                    <ShieldCheck className="h-4 w-4 text-brand-600" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Encrypted & Secure Data</p>
                  </div>
                )}

                {isText ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea
                        id={`req-${requirement.id}`}
                        className="min-h-[140px] w-full rounded-2xl border-none bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 shadow-inner ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-brand-500"
                        placeholder="Provide the requested details..."
                        value={textValue}
                        onChange={(event) =>
                          setDocumentDraft(requirement.id, {
                            value: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="max-w-[60%] text-[10px] font-medium text-slate-400 leading-relaxed italic">
                        {status === "verified"
                          ? "Credentials verified by audit team."
                          : status === "rejected"
                            ? "Please update your response based on the feedback."
                            : "Your response will be reviewed by our compliance team."}
                      </p>
                      <Button
                        className="h-10 rounded-xl px-6 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-100"
                        disabled={!item || updateItemMutation.isPending}
                        loading={updateItemMutation.isPending}
                        onClick={saveText}
                      >
                        Save Response
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="relative group">
                        <label
                          htmlFor={`file-input-${requirement.id}`}
                          className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 transition-all hover:border-brand-300 hover:bg-white hover:shadow-xl"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-400 group-hover:text-brand-600 mb-2 transition-colors">
                            <Files className="h-6 w-6" />
                          </div>
                          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">
                            {stagedFile ? stagedFile.name : "Select Document"}
                          </span>
                          <input
                            id={`file-input-${requirement.id}`}
                            type="file"
                            accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                setDocumentDraft(requirement.id, { file });
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex flex-col justify-center gap-4">
                        {stagedFile ? (
                          <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">New Selection</p>
                            <p className="text-sm font-bold text-brand-600 truncate">{stagedFile.name}</p>
                            <p className="mt-1 text-[10px] font-medium text-slate-400 italic">Ready to upload</p>
                          </div>
                        ) : item && (item.download_url || item.file_url) ? (
                          <div className="rounded-2xl bg-brand-50/50 p-4 ring-1 ring-brand-500/10">
                            <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest leading-none mb-1">Current File</p>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-brand-600 truncate">Document ID: {item.id.slice(0, 8)}</p>
                              <Button
                                variant="ghost"
                                className="h-7 w-7 p-0 rounded-lg bg-white text-brand-600"
                                onClick={() => setPreviewItem(item)}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5 text-center">
                            <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-4">
                              No document uploaded yet. Please provide a valid certificate or ID.
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {stagedFile && (
                            <Button
                              variant="ghost"
                              className="h-10 flex-1 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => clearDocumentDraft(requirement.id)}
                            >
                              Clear
                            </Button>
                          )}
                          <Button
                            className="h-10 flex-1 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-100"
                            onClick={uploadFile}
                            disabled={!item || !stagedFile || uploadItemFileMutation.isPending}
                            loading={uploadItemFileMutation.isPending}
                          >
                            Upload File
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reviewerNote && (
                  <div className="flex items-start gap-3 rounded-2xl bg-rose-50/50 p-6 ring-1 ring-rose-600/10">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm ring-1 ring-rose-200">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest leading-none mb-1">Reviewer Feedback</p>
                      <p className="text-xs font-medium text-rose-800/80 leading-relaxed italic">{reviewerNote}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );


  const renderReviewStep = () => (
    <Card
      className="relative overflow-hidden border-none bg-white p-10 shadow-xl ring-1 ring-black/5"
      title={<span className="text-2xl font-black text-slate-900">Final Verification Audit</span>}
      description="Please confirm all details are accurate. Once submitted, your profile will enter the formal audit queue."
    >
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-500/5 blur-3xl opacity-50" />

      <div className="relative mt-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[32px] bg-slate-50/50 p-6 ring-1 ring-black/5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4">Application Status</p>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-brand-600">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-900 capitalize">{application?.status ?? "Draft"}</p>
                <p className="text-xs font-medium text-slate-500">Currently in preparation</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-slate-50/50 p-6 ring-1 ring-black/5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4">Submission Readiness</p>
            <div className="flex items-center gap-4">
              <div className={classNames(
                "flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm",
                canSubmit ? "text-emerald-600" : "text-rose-600"
              )}>
                {canSubmit ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">{canSubmit ? "Protocol Ready" : "Incomplete Protocol"}</p>
                <p className="text-xs font-medium text-slate-500">{canSubmit ? "All requirements matched" : "Check items in Identity & Verification"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-transparent bg-slate-50/50 p-8 ring-1 ring-black/5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Provider Profile Summary</p>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm text-slate-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Daily Capacity</p>
                <p className="text-sm font-bold text-slate-900">{profile?.daily_request_limit ?? 0} Tasks per day</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm text-slate-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Emergency Readiness</p>
                <p className="text-sm font-bold text-slate-900">{profile?.can_emergency ? "Active - Prepared for emergencies" : "Inactive - Normal operations only"}</p>
              </div>
            </div>
          </div>
        </div>

        {application?.notes && (
          <div className="flex items-start gap-4 rounded-[32px] bg-brand-50 p-8 ring-1 ring-brand-500/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest leading-none mb-2">Auditor Correspondence</p>
              <p className="text-xs font-medium text-brand-900/70 leading-relaxed italic">{application.notes}</p>
            </div>
          </div>
        )}

        {application?.items && application.items.length > 0 && (
          <div className="pt-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Submission Ledger</p>
            <div className="overflow-hidden rounded-2xl ring-1 ring-black/5">
              <table className="w-full text-left text-xs text-slate-500">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Requirement</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {application.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {requirements?.find(r => r.id === item.requirement_id || r.id === item.requirement_type?.id)?.label ?? "Protocol Item"}
                      </td>
                      <td className="px-6 py-4 flex justify-center">
                        {statusBadge(item.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  const renderStepContent = () => {
    if (loadingRequirements || loadingApplication || isFetching) {
      return <Loading fullHeight />;
    }

    if (!application && !createApplicationMutation.isPending) {
      return renderOverview();
    }

    switch (currentStep) {
      case 0:
        return renderOverview();
      case 1:
        return renderProfileStep();
      case 2:
        return renderDocumentsStep();
      case 3:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const nextStep = () => setStep(Math.min(currentStep + 1, steps.length - 1));
  const prevStep = () => setStep(Math.max(currentStep - 1, 0));

  const submitting = submitMutation.isPending;
  const disableSubmit =
    !canSubmit || submitting || !application || !["draft", "under_review"].includes(application.status);

  const clearPreview = useCallback(() => {
    setPreviewItem(null);
    setPreviewError(null);
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    let endpoint = previewItem?.download_url ?? previewItem?.file_url;
    if (!previewItem || !endpoint) {
      setPreviewLoading(false);
      setPreviewError(previewItem && !endpoint ? "No document available." : null);
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
      return;
    }

    if (endpoint.startsWith("/api/")) {
      endpoint = endpoint.replace(/^\/api\/v1/, "");
    }

    let cancelled = false;
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);

    api
      .get(endpoint, { responseType: "blob", signal: controller.signal })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const objectUrl = URL.createObjectURL(response.data);
        setPreviewUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return objectUrl;
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (isAxiosError(error) && error.code === "ERR_CANCELED") {
          return;
        }
        setPreviewError(error instanceof Error ? error.message : "Unable to load document.");
        setPreviewUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
    };
  }, [previewItem]);

  const renderPreviewModal = () => (
    <Modal
      open={Boolean(previewItem)}
      onClose={clearPreview}
      title={previewItem?.requirement_type?.label ?? "Document preview"}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {previewLoading ? (
          <div className="flex h-[70vh] items-center justify-center">
            <Loading />
          </div>
        ) : previewError ? (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{previewError}</div>
        ) : previewUrl ? (
          <iframe
            key={previewUrl}
            src={previewUrl}
            title="Uploaded document"
            className="h-[70vh] w-full rounded-lg border border-slate-200"
          />
        ) : (
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            No document available to preview.
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={clearPreview}>
            Close
          </Button>
          <Button
            onClick={() => {
              const downloadTarget = previewItem?.download_url ?? previewItem?.file_url ?? null;
              if (downloadTarget) {
                const resolved =
                  downloadTarget.startsWith("/api/") && typeof window !== "undefined"
                    ? `${window.location.origin}${downloadTarget}`
                    : downloadTarget;
                window.open(resolved, "_blank", "noopener,noreferrer");
              }
            }}
            disabled={!previewItem || (!previewItem.download_url && !previewItem.file_url)}
          >
            Download
          </Button>
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="space-y-8 pb-32">
      <header className="relative overflow-hidden rounded-[40px] border border-white/80 bg-white/40 p-10 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-linear text-white shadow-lg shadow-brand-100">
                <Rocket className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">Partner Launchpad</h1>
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Verification Pipeline</p>
                </div>
              </div>
            </div>
            <p className="max-w-xl text-lg font-medium leading-relaxed text-slate-600">
              Welcome to the team. Complete your verification checklist to unlock your full potential as a Tiba provider.
            </p>
          </div>

          {application && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 capitalize">{application.status.replace(/_/g, " ")}</p>
                </div>
                <div className={classNames(
                  "h-10 w-10 flex items-center justify-center rounded-xl",
                  application.status === "approved" ? "bg-emerald-500 text-white" : "bg-brand-500 text-white"
                )}>
                  {application.status === "approved" ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
              <div
                className="h-full bg-brand-linear transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(var(--brand-500),0.3)]"
                style={{ width: `${application?.progress_percent ?? 0}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <span>{application?.progress_percent ?? 0}% Detailed Profile</span>
              <span>Verification Complete</span>
            </div>
          </div>
          <Button
            variant="secondary"
            className="rounded-2xl border-none bg-white/60 shadow-md ring-1 ring-black/5 backdrop-blur-sm"
            onClick={() => navigate("/pro/help")}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Need Help?
          </Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr,3fr]">
        <aside className="lg:sticky lg:top-8 h-fit space-y-4">
          <div className="rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-xl backdrop-blur-sm ring-1 ring-black/5">
            <p className="mb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Onboarding Progress</p>
            <div className="space-y-4">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                return (
                  <button
                    key={step.title}
                    onClick={() => application && setStep(index)}
                    disabled={!application && index !== 0}
                    className={classNames(
                      "group flex w-full items-center gap-4 rounded-2xl p-4 transition-all duration-300",
                      isActive ? "bg-white shadow-lg ring-1 ring-black/5" : "hover:bg-white/40"
                    )}
                  >
                    <div className={classNames(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                      isCompleted ? "bg-emerald-500 text-white" :
                        isActive ? "bg-brand-500 text-white shadow-lg shadow-brand-100" :
                          "bg-slate-100 text-slate-400 group-hover:bg-white"
                    )}>
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                    </div>
                    <div className="text-left">
                      <p className={classNames(
                        "text-sm font-bold tracking-tight transition-colors",
                        isActive ? "text-slate-900" : "text-slate-500"
                      )}>
                        {step.title}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{step.description}</p>
                    </div>
                    {isActive && <ChevronRight className="ml-auto h-4 w-4 text-brand-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="space-y-8">
          {renderStepContent()}
        </main>
      </div>

      {renderPreviewModal()}

      <StickyActionBar>
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="hidden md:flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none underline decoration-brand-500/30 decoration-2 underline-offset-4">Guide</p>
              <p className="mt-1 text-xs font-bold text-slate-600">
                {application?.status === "submitted"
                  ? "Your journey is under review."
                  : application?.status === "approved"
                    ? "Welcome aboard, Partner!"
                    : application?.status === "under_review"
                      ? "Review admin feedback and resubmit."
                      : "Progress is mission-critical & auto-saved."}
              </p>
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-3 md:w-auto">
            <Button
              variant="ghost"
              className="h-11 rounded-xl px-6 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              {currentStep === 0 ? "Initial Brief" : "Previous"}
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                className="h-11 rounded-xl px-8 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-100"
                onClick={nextStep}
                disabled={currentStep === steps.length - 1 || !application}
              >
                Next Step
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="h-11 rounded-xl px-8 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-100"
                onClick={() => submitMutation.mutate()}
                disabled={disableSubmit}
                loading={submitting}
              >
                Launch Application
                <Rocket className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </StickyActionBar>
    </div>
  );
};

export default OnboardingPage;
