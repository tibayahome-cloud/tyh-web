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
import { onboardingStatusKey, useOnboardingStatus } from "../hooks/useOnboardingStatus";
import { OnboardingChecklist, type ChecklistItem } from "../components/onboarding/OnboardingChecklist";
import { OnboardingStatusCard } from "../components/onboarding/OnboardingStatusCard";
import { OnboardingTimeline } from "../components/onboarding/OnboardingTimeline";
import { SendForReviewDialog } from "../components/onboarding/SendForReviewDialog";
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
    editable_after_submission?: boolean;
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
  const application = applicationQuery.data ?? null;

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ source: string; title: string } | null>(null);
  const [confirmingSend, setConfirmingSend] = useState(false);

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

  const remove = useMutation({
    mutationFn: async (itemId: string) => {
      if (!application) throw new Error("No application yet");
      await api.delete(`/provider-applications/${application.id}/items/${itemId}/document`);
    },
    onMutate: (itemId) => setBusyItemId(itemId),
    onSuccess: () => {
      toast.showToast({ title: "Removed", variant: "success" });
      refresh();
    },
    onError: fail("Could not remove it"),
    onSettled: () => setBusyItemId(null)
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
        editableAfterSend: Boolean(item.requirement_type?.editable_after_submission),
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
        onSubmit={() => setConfirmingSend(true)}
        checklistShown={showChecklist}
      />

      {["not_started", "documents_needed", "in_review", "needs_changes"].includes(summary.status) && <OnboardingTimeline summary={summary} />}

      {showChecklist && (
        <section aria-label="Your documents" className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Your documents</h2>
          <OnboardingChecklist
            items={items}
            busyItemId={busyItemId}
            onUpload={(itemId, file, expiresOn) => upload.mutate({ itemId, file, expiresOn })}
            onSaveText={(itemId, text) => saveText.mutate({ itemId, text })}
            onView={view}
            onRemove={(itemId) => remove.mutate(itemId)}
            sentForReview={summary.status === "in_review"}
          />
        </section>
      )}

      <SendForReviewDialog
        open={confirmingSend}
        items={items}
        submitting={submit.isPending}
        onConfirm={() => submit.mutate(undefined, { onSettled: () => setConfirmingSend(false) })}
        onClose={() => setConfirmingSend(false)}
      />

      <DocumentPreviewModal source={viewing?.source ?? null} title={viewing?.title ?? "Document"} onClose={() => setViewing(null)} />
    </div>
  );
};

export default OnboardingPage;
