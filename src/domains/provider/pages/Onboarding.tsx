import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { Loading } from "../../../shared/components/Loading";
import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, provApp } from "../../../shared/libs/fieldInclude";
import { getApiError } from "../../../shared/utils/errors";
import { useProviderProfile } from "../hooks/useProviderProfile";
import { onboardingStatusKey, useOnboardingStatus } from "../hooks/useOnboardingStatus";
import { OnboardingChecklist, type ChecklistItem } from "../components/onboarding/OnboardingChecklist";
import { OnboardingStatusCard } from "../components/onboarding/OnboardingStatusCard";
import { DocumentPreviewModal } from "../components/onboarding/DocumentPreviewModal";

type ApplicationItem = {
  id: string;
  status: string;
  value_text?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  comment?: string | null;
  expires_on?: string | null;
  requirement_type?: {
    id: string;
    key?: string;
    label: string;
    input_type: "file" | "image" | "text";
    display_order?: number | null;
    required_for_verification?: boolean;
    has_expiry?: boolean;
  };
};

type Application = { id: string; status: string; items?: ApplicationItem[] };

const applicationKey = ["provider", "application"] as const;

const useApplicationQuery = () =>
  useQuery({
    queryKey: applicationKey,
    queryFn: async () => {
      try {
        const response = await api.get<{ data: Application }>("/provider-applications/me", { params: buildFieldParams(provApp) });
        return response.data.data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
    refetchOnWindowFocus: false
  });

const OnboardingPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const statusQuery = useOnboardingStatus();
  const applicationQuery = useApplicationQuery();
  const { data: profile } = useProviderProfile(user?.id);
  const application = applicationQuery.data ?? null;

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ source: string; title: string } | null>(null);
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [canEmergency, setCanEmergency] = useState<boolean | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: applicationKey }).catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: onboardingStatusKey }).catch(() => undefined);
  };

  useEffect(() => {
    if (!socket || !user?.id) return;
    const onNotification = (payload: { user_id?: string; event_key?: string }) => {
      if (payload?.user_id !== user.id) return;
      if (payload.event_key === "provider.application.resubmission_requested") {
        toast.showToast({ title: "More information needed", description: "Please look at the documents marked Sent back.", variant: "info" });
        refresh();
      }
      if (payload.event_key === "provider.application.requirement_added") {
        toast.showToast({ title: "A new document is needed", description: "We added it to your list.", variant: "info" });
        refresh();
      }
      if (payload.event_key === "provider.application.approved" || payload.event_key === "provider.application.reviewed") {
        refresh();
      }
    };
    const onBootstrap = (payload: { user_id?: string }) => {
      if (payload?.user_id === user.id) refresh();
    };
    socket.on("notification.created", onNotification);
    socket.on("model.provider.onboarding.bootstrap", onBootstrap);
    return () => {
      socket.off("notification.created", onNotification);
      socket.off("model.provider.onboarding.bootstrap", onBootstrap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.id]);

  const fail = (title: string) => (error: unknown) =>
    toast.showToast({ title, description: getApiError(error, "Please try again."), variant: "error" });

  const start = useMutation({
    mutationFn: async () => {
      // Creates the checklist, or tops up an existing one with newly required documents, without touching verification.
      await api.post("/provider-applications/me/open", {});
    },
    onSuccess: refresh,
    onError: fail("Could not start your verification")
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!application) throw new Error("No application yet");
      await api.post(`/provider-applications/${application.id}/submit`, {});
    },
    onSuccess: () => {
      toast.showToast({ title: "Sent for review", description: "We will tell you when it is done.", variant: "success" });
      refresh();
    },
    onError: fail("Could not send for review")
  });

  const upload = useMutation({
    mutationFn: async ({ itemId, file, expiresOn }: { itemId: string; file: File; expiresOn?: string }) => {
      if (!application) throw new Error("No application yet");
      const formData = new FormData();
      formData.append("file", file);
      if (expiresOn) formData.append("expires_on", expiresOn);
      await api.post(`/provider-applications/${application.id}/items/${itemId}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onMutate: ({ itemId }) => setBusyItemId(itemId),
    onSuccess: () => {
      toast.showToast({ title: "Document uploaded", variant: "success" });
      refresh();
    },
    onError: fail("Upload failed"),
    onSettled: () => setBusyItemId(null)
  });

  const saveText = useMutation({
    mutationFn: async ({ itemId, text }: { itemId: string; text: string }) => {
      if (!application) throw new Error("No application yet");
      await api.put(`/provider-applications/${application.id}/items/${itemId}`, { value_text: text, status: "pending" });
    },
    onMutate: ({ itemId }) => setBusyItemId(itemId),
    onSuccess: () => {
      toast.showToast({ title: "Answer saved", variant: "success" });
      refresh();
    },
    onError: fail("Could not save"),
    onSettled: () => setBusyItemId(null)
  });

  const saveLimits = useMutation({
    mutationFn: async (payload: { daily_request_limit: number; can_emergency: boolean }) => {
      if (!user?.id) throw new Error("Not signed in");
      await api.patch(`/providers/${user.id}`, payload);
    },
    onSuccess: () => {
      toast.showToast({ title: "Saved", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["provider", "profile", user?.id] }).catch(() => undefined);
    },
    onError: fail("Could not save")
  });

  const items: ChecklistItem[] = useMemo(() => {
    const noteByLabel = new Map((statusQuery.data?.items ?? []).map((item) => [item.label, item.reviewer_note]));
    return [...(application?.items ?? [])]
      .sort((a, b) => (a.requirement_type?.display_order ?? 0) - (b.requirement_type?.display_order ?? 0))
      .map((item) => ({
        id: item.id,
        requirementKey: item.requirement_type?.key ?? null,
        label: item.requirement_type?.label ?? "Document",
        inputType: item.requirement_type?.input_type ?? "file",
        status: item.status,
        valueText: item.value_text ?? null,
        hasFile: Boolean(item.download_url || item.file_url),
        required: Boolean(item.requirement_type?.required_for_verification),
        hasExpiry: Boolean(item.requirement_type?.has_expiry),
        expiresOn: item.expires_on ?? null,
        reviewerNote: noteByLabel.get(item.requirement_type?.label ?? "") ?? (item.status === "rejected" ? item.comment ?? null : null)
      }));
  }, [application?.items, statusQuery.data?.items]);

  if (statusQuery.isPending || applicationQuery.isPending) return <Loading fullHeight />;

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-semibold">We could not load your verification.</p>
          <Button type="button" className="mt-3 min-h-[44px]" variant="secondary" onClick={() => statusQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const summary = statusQuery.data;
  // A provider set up by their facility has nothing to upload, unless documents are now owed.
  const showChecklist = items.length > 0 && (summary.status !== "set_up_by_facility" || !summary.documentsInOrder);
  const limitValue = dailyLimit !== "" ? dailyLimit : String(profile?.daily_request_limit ?? 0);
  const emergencyValue = canEmergency ?? profile?.can_emergency ?? false;

  const view = (itemId: string) => {
    const item = application?.items?.find((entry) => entry.id === itemId);
    const source = item?.download_url ?? item?.file_url;
    if (source) setViewing({ source, title: item?.requirement_type?.label ?? "Document" });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Your verification</h1>
        <p className="text-sm text-slate-700">We check your documents once, so clients can trust who they book.</p>
      </div>

      <OnboardingStatusCard
        summary={summary}
        starting={start.isPending}
        submitting={submit.isPending}
        onStart={() => start.mutate()}
        onSubmit={() => submit.mutate()}
        checklistShown={showChecklist}
      />

      {showChecklist && (
        <section aria-label="Your documents" className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Your documents</h2>
          <OnboardingChecklist
            items={items}
            busyItemId={busyItemId}
            onUpload={(itemId, file, expiresOn) => upload.mutate({ itemId, file, expiresOn })}
            onSaveText={(itemId, text) => saveText.mutate({ itemId, text })}
            onView={view}
          />
        </section>
      )}

      <section aria-label="Work settings" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">How much work you can take</h2>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveLimits.mutate({ daily_request_limit: Math.max(0, Number(limitValue) || 0), can_emergency: Boolean(emergencyValue) });
          }}
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Most requests you can take in a day</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={limitValue}
              onChange={(event) => setDailyLimit(event.target.value)}
              className="mt-2 h-11 w-full max-w-[160px] rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
            />
          </label>
          <label className="flex min-h-[44px] items-start gap-3">
            <input
              type="checkbox"
              checked={Boolean(emergencyValue)}
              onChange={(event) => setCanEmergency(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-400"
            />
            <span className="text-sm text-slate-800">I can respond to urgent requests near me</span>
          </label>
          <Button type="submit" className="min-h-[44px]" loading={saveLimits.isPending}>
            Save
          </Button>
        </form>
      </section>

      <DocumentPreviewModal source={viewing?.source ?? null} title={viewing?.title ?? "Document"} onClose={() => setViewing(null)} />
    </div>
  );
};

export default OnboardingPage;
