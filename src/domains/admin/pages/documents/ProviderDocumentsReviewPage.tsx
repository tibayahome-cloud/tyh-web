import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import ApiErrorBanner from "../../../../shared/components/ApiErrorBanner";
import { Button } from "../../../../shared/components/Button";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Skeleton } from "../../../../shared/components/Skeleton";
import { useToast } from "../../../../shared/components/ToastProvider";
import { classifyApiError, getApiError } from "../../../../shared/utils/errors";
import { DocumentPreviewModal } from "../../../provider/components/onboarding/DocumentPreviewModal";
import { describeExpiry } from "../../../provider/utils/documentDisplay";
import { fetchApplicationForReview, reviewDetailKey, reviewItem, type ReviewItem } from "./reviewApi";
import { describeItem, requiredProgress, splitItems } from "./reviewDisplay";

const TONE: Record<string, string> = {
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200"
};

const EXPIRY_TONE = { ok: "text-slate-600", soon: "text-amber-800", expired: "text-rose-700" } as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";

type Decision = { item: ReviewItem; kind: "send_back" } | null;

/** One provider's documents, one decision at a time: approve, or send back with what to fix. */
export const ProviderDocumentsReviewPage = () => {
  const { applicationId = "" } = useParams<{ applicationId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [viewing, setViewing] = useState<{ source: string; title: string } | null>(null);
  const [sendBack, setSendBack] = useState<Decision>(null);
  const [note, setNote] = useState("");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: reviewDetailKey(applicationId),
    queryFn: () => fetchApplicationForReview(applicationId),
    enabled: Boolean(applicationId)
  });

  const application = query.data;
  const providerName = application?.user?.full_name || "This provider";
  const items = application?.items ?? [];
  const progress = requiredProgress(items);
  const { required, other } = splitItems(items);
  // Documents the provider has not added need no decision, so they sit behind one line instead of a long empty list.
  const provided = other.filter((item) => item.status !== "missing");
  const notAdded = other.filter((item) => item.status === "missing");
  const verified = application?.status === "approved";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "document-review"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications"] });
  };

  const decide = useMutation({
    mutationFn: ({ item, decision }: { item: ReviewItem; decision: { decision: "approved" } | { decision: "sent_back"; note: string } }) =>
      reviewItem(applicationId, item.id, decision),
    onMutate: ({ item }) => setBusyItemId(item.id),
    onSuccess: (result, { item, decision }) => {
      const label = item.requirement_type?.label ?? "Document";
      if (decision.decision === "sent_back") {
        toast.showToast({ title: "Sent back", description: `${providerName} has been told what to fix in ${label}.`, variant: "success" });
        setSendBack(null);
        setNote("");
      } else if (result.provider_verified && !verified) {
        toast.showToast({ title: `${providerName} is now verified`, description: "All required documents are approved.", variant: "success" });
      } else {
        toast.showToast({ title: "Approved", description: label, variant: "success" });
      }
      refresh();
    },
    onError: (error) => toast.showToast({ title: "That did not go through", description: getApiError(error, "Please try again."), variant: "error" }),
    onSettled: () => setBusyItemId(null)
  });

  const view = (item: ReviewItem) => {
    const source = item.download_url ?? item.file_url;
    if (source) setViewing({ source, title: item.requirement_type?.label ?? "Document" });
  };

  const renderItem = (item: ReviewItem) => {
    const label = item.requirement_type?.label ?? "Document";
    const state = describeItem(item, application?.status ?? "draft");
    const expiry = item.requirement_type?.has_expiry ? describeExpiry(item.expires_on) : null;
    const hasFile = Boolean(item.download_url || item.file_url);
    const busy = busyItemId === item.id;
    return (
      <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${TONE[state.tone]}`}>{state.label}</span>
        </div>
        {item.requirement_type?.input_type === "text" && item.value_text && (
          <p className="mt-2 break-all text-sm text-slate-800">{item.value_text}</p>
        )}
        {expiry && <p className={`mt-2 text-sm ${EXPIRY_TONE[expiry.tone]}`}>{expiry.text}</p>}
        {item.status === "rejected" && item.comment && (
          <p className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            <span className="font-medium">What you asked them to fix: </span>
            {item.comment}
          </p>
        )}
        {(hasFile || state.canDecide) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {hasFile && (
              <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => view(item)} aria-label={`View ${label}`}>
                View
              </Button>
            )}
            {state.canDecide && (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-[44px]"
                  loading={busy && decide.isPending}
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ item, decision: { decision: "approved" } })}
                  aria-label={`Approve ${label}`}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={decide.isPending}
                  onClick={() => {
                    setNote("");
                    setSendBack({ item, kind: "send_back" });
                  }}
                  aria-label={`Send back ${label}`}
                >
                  Send back
                </Button>
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <Link to="/admin/documents/providers" className={`inline-flex min-h-[44px] w-fit items-center gap-1 rounded-lg text-sm font-medium text-tiba-blue ${focusRing}`}>
        <ArrowBackIcon aria-hidden fontSize="small" />
        All providers
      </Link>

      {query.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading documents">
          <Skeleton height={72} rounded="lg" />
          <Skeleton height={96} rounded="lg" />
          <Skeleton height={96} rounded="lg" />
        </div>
      ) : query.isError || !application ? (
        <ApiErrorBanner {...classifyApiError(query.error, "We couldn't open this provider's documents.")} onRetry={() => query.refetch()} />
      ) : (
        <>
          <header>
            <h1 className="text-xl font-semibold text-slate-900">{providerName}</h1>
            {application.user?.email && <p className="text-sm text-slate-600">{application.user.email}</p>}
            <div className="mt-3" role="group" aria-label="Required documents approved">
              <p className="text-sm font-medium text-slate-800">
                {progress.approved} of {progress.total} required documents approved
              </p>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.approved}
                aria-label="Required documents approved"
              >
                <div className="h-full rounded-full bg-emerald-600" style={{ width: progress.total ? `${(progress.approved / progress.total) * 100}%` : "0%" }} />
              </div>
            </div>
          </header>

          {verified ? (
            <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <span className="font-semibold">{providerName} is verified.</span> Every required document is approved.
            </p>
          ) : application.status === "submitted" ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Approve the last required document and {providerName} is verified. You do not need a second approval.
            </p>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {providerName} has not sent these for review yet, so there is nothing to decide. They are shown here so you can see their progress.
            </p>
          )}

          <section aria-label="Required documents" className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-slate-900">Required documents</h2>
            <ul className="flex flex-col gap-3">{required.map(renderItem)}</ul>
          </section>

          {provided.length > 0 && (
            <section aria-label="Other documents" className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-slate-900">Other documents</h2>
              <ul className="flex flex-col gap-3">{provided.map(renderItem)}</ul>
            </section>
          )}

          {notAdded.length > 0 && (
            <details className="rounded-2xl border border-slate-200 bg-white p-4">
              <summary className={`min-h-[44px] cursor-pointer text-sm font-medium text-slate-700 ${focusRing}`}>
                {notAdded.length} other {notAdded.length === 1 ? "document" : "documents"} not added
              </summary>
              <ul className="mt-3 flex flex-col gap-3">{notAdded.map(renderItem)}</ul>
            </details>
          )}
        </>
      )}

      <DocumentPreviewModal source={viewing?.source ?? null} title={viewing?.title ?? "Document"} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={Boolean(sendBack)}
        title={`Send back ${sendBack?.item.requirement_type?.label ?? "document"}`}
        description={`Tell ${providerName} what to fix. They will see your note and can replace the document.`}
        confirmLabel="Send back"
        confirmVariant="primary"
        loading={decide.isPending}
        confirmDisabled={note.trim().length < 3}
        onConfirm={() => {
          if (sendBack) decide.mutate({ item: sendBack.item, decision: { decision: "sent_back", note: note.trim() } });
        }}
        onClose={() => {
          setSendBack(null);
          setNote("");
        }}
      >
        <label className="block text-sm font-medium text-slate-800">
          What needs to change
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder="For example: The photo is blurry. Please upload a clear scan of both sides."
            className={`mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 placeholder:text-slate-500 ${focusRing}`}
          />
        </label>
      </ConfirmDialog>
    </div>
  );
};

export default ProviderDocumentsReviewPage;
