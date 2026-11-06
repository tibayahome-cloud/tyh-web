import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ApiErrorBanner from "../../../../shared/components/ApiErrorBanner";
import { Button } from "../../../../shared/components/Button";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Skeleton } from "../../../../shared/components/Skeleton";
import { useToast } from "../../../../shared/components/ToastProvider";
import { classifyApiError, getApiError } from "../../../../shared/utils/errors";
import { UploadMenu } from "../../../provider/components/onboarding/OnboardingChecklist";
import { DocumentPreviewModal } from "../../../provider/components/onboarding/DocumentPreviewModal";
import { describeExpiry } from "../../../provider/utils/documentDisplay";
import { DOCUMENT_HINT } from "../../../provider/utils/documentFiles";
import {
  facilityDocumentsKey,
  fetchFacilityDocuments,
  removeFacilityDocument,
  reviewFacilityDocument,
  sendFacilityDocuments,
  setFacilityDocumentApplicable,
  uploadFacilityDocument,
  type FacilityDocument,
  type FacilityReviewDecision
} from "./facilityDocumentsApi";
import { FACILITY_STATUS, describeGrace, groupFacilityDocuments, summaryBanner, type Tone } from "./facilityDocumentsDisplay";

export type PanelMode = "facility_admin" | "super_admin";

const TONE: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-sky-50 text-sky-800 border-sky-200"
};
const EXPIRY_TONE = { ok: "text-slate-600", soon: "text-amber-800", expired: "text-rose-700" } as const;
const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";
const todayIso = () => new Date().toISOString().slice(0, 10);

type Props = { facilityId: string; mode: PanelMode };

/** A facility's checklist. The facility admin adds and sends; the super admin can add for them and alone decides. */
export const FacilityDocumentsPanel = ({ facilityId, mode }: Props) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [expiryById, setExpiryById] = useState<Record<string, string>>({});
  const [problemById, setProblemById] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ source: string; title: string } | null>(null);
  const [sendBack, setSendBack] = useState<FacilityDocument | null>(null);
  const [note, setNote] = useState("");

  const query = useQuery({ queryKey: facilityDocumentsKey(facilityId), queryFn: () => fetchFacilityDocuments(facilityId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "facility-documents"] });
  const fail = (title: string) => (error: unknown) => toast.showToast({ title, description: getApiError(error, "Please try again."), variant: "error" });

  const upload = useMutation({
    mutationFn: ({ doc, file }: { doc: FacilityDocument; file: File }) =>
      uploadFacilityDocument(facilityId, doc.id, file, doc.requirement.has_expiry ? expiryById[doc.id] ?? doc.expires_on ?? undefined : undefined),
    onMutate: ({ doc }) => setBusyId(doc.id),
    onSuccess: () => {
      toast.showToast({
        title: "Document added",
        description: mode === "facility_admin" ? "Send it for review when you are ready." : undefined,
        variant: "success"
      });
      refresh();
    },
    onError: fail("Upload failed"),
    onSettled: () => setBusyId(null)
  });

  const remove = useMutation({
    mutationFn: (doc: FacilityDocument) => removeFacilityDocument(facilityId, doc.id),
    onMutate: (doc) => setBusyId(doc.id),
    onSuccess: () => {
      toast.showToast({ title: "Removed", variant: "success" });
      refresh();
    },
    onError: fail("Could not remove it"),
    onSettled: () => setBusyId(null)
  });

  const send = useMutation({
    mutationFn: () => sendFacilityDocuments(facilityId),
    onSuccess: (count) => {
      toast.showToast({ title: "Sent for review", description: `${count} ${count === 1 ? "document" : "documents"} sent. We will tell you when it is done.`, variant: "success" });
      refresh();
    },
    onError: fail("Could not send for review")
  });

  const applicability = useMutation({
    mutationFn: ({ doc, applicable }: { doc: FacilityDocument; applicable: boolean }) => setFacilityDocumentApplicable(facilityId, doc.id, applicable),
    onMutate: ({ doc }) => setBusyId(doc.id),
    onSuccess: () => refresh(),
    onError: fail("Could not change that"),
    onSettled: () => setBusyId(null)
  });

  const decide = useMutation({
    mutationFn: ({ doc, decision }: { doc: FacilityDocument; decision: FacilityReviewDecision }) => reviewFacilityDocument(doc.id, decision),
    onMutate: ({ doc }) => setBusyId(doc.id),
    onSuccess: (result, { doc, decision }) => {
      if (decision.decision === "sent_back") {
        toast.showToast({ title: "Sent back", description: `The facility has been told what to fix in ${doc.requirement.label}.`, variant: "success" });
        setSendBack(null);
        setNote("");
      } else if (result.summary.in_order) {
        toast.showToast({ title: "All required documents are approved", description: doc.requirement.label, variant: "success" });
      } else {
        toast.showToast({ title: "Approved", description: doc.requirement.label, variant: "success" });
      }
      refresh();
    },
    onError: fail("That did not go through"),
    onSettled: () => setBusyId(null)
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading documents">
        <Skeleton height={120} rounded="lg" />
        <Skeleton height={96} rounded="lg" />
        <Skeleton height={96} rounded="lg" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ApiErrorBanner {...classifyApiError(query.error, "We couldn't open these documents.")} onRetry={() => query.refetch()} />;
  }

  const { documents, summary } = query.data;
  const groups = groupFacilityDocuments(documents);
  const banner = summaryBanner(summary, mode);
  const grace = describeGrace(summary);
  const percent = summary.required_total ? (summary.required_approved / summary.required_total) * 100 : 0;

  const renderDocument = (doc: FacilityDocument) => {
    const status = FACILITY_STATUS[doc.status];
    const expiry = doc.requirement.has_expiry ? describeExpiry(doc.expires_on) : null;
    const busy = busyId === doc.id;
    const needsDate = doc.requirement.has_expiry;
    const date = expiryById[doc.id] ?? doc.expires_on ?? "";
    const canReview = mode === "super_admin" && doc.has_file && (doc.status === "submitted" || doc.status === "uploaded");
    const canRemove = doc.has_file && (doc.status === "uploaded" || doc.status === "rejected" || (mode === "super_admin" && doc.status === "verified"));
    const heldByTiba = !doc.can_upload && doc.requirement.super_admin_uploads;
    return (
      <li key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">{doc.requirement.label}</h3>
            {doc.requirement.description && <p className="mt-0.5 text-xs text-slate-600">{doc.requirement.description}</p>}
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${TONE[status.tone]}`}>{status.label}</span>
        </div>
        {heldByTiba && mode === "facility_admin" && <p className="mt-2 text-xs text-slate-600">Added by Tiba Ya Home. You do not need to upload it.</p>}
        {expiry && <p className={`mt-2 text-sm ${EXPIRY_TONE[expiry.tone]}`}>{expiry.text}</p>}
        {doc.status === "rejected" && doc.comment && (
          <p className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            <span className="font-medium">{mode === "super_admin" ? "What you asked them to fix: " : "What to change: "}</span>
            {doc.comment}
          </p>
        )}
        {problemById[doc.id] && (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {problemById[doc.id]}
          </p>
        )}
        {doc.can_upload && needsDate && (
          <label className="mt-3 block text-sm font-medium text-slate-800">
            Expiry date
            <input
              type="date"
              min={todayIso()}
              value={date}
              onChange={(event) => setExpiryById((current) => ({ ...current, [doc.id]: event.target.value }))}
              className={`mt-1 block min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 sm:w-56 ${focusRing}`}
            />
          </label>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {doc.has_file && doc.download_url && (
            <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" aria-label={`View ${doc.requirement.label}`} onClick={() => setViewing({ source: doc.download_url as string, title: doc.requirement.label })}>
              View
            </Button>
          )}
          {doc.can_upload && (
            <UploadMenu
              label={doc.has_file ? `Replace ${doc.requirement.label}` : `Upload ${doc.requirement.label}`}
              busy={busy && upload.isPending}
              disabled={decide.isPending || (needsDate && !date)}
              onPick={(file) => upload.mutate({ doc, file })}
              onProblem={(message) => setProblemById((current) => ({ ...current, [doc.id]: message }))}
            />
          )}
          {canRemove && (
            <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" aria-label={`Remove ${doc.requirement.label}`} disabled={busy} onClick={() => remove.mutate(doc)}>
              Remove
            </Button>
          )}
          {doc.requirement.only_if_offered && doc.status === "missing" && (
            <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" disabled={busy} onClick={() => applicability.mutate({ doc, applicable: false })}>
              {mode === "super_admin" ? "Does not apply to this facility" : "This does not apply to us"}
            </Button>
          )}
          {doc.status === "not_applicable" && (
            <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" disabled={busy} onClick={() => applicability.mutate({ doc, applicable: true })}>
              {mode === "super_admin" ? "It does apply" : "This does apply to us"}
            </Button>
          )}
          {canReview && (
            <>
              <Button type="button" size="sm" className="min-h-[44px]" aria-label={`Approve ${doc.requirement.label}`} loading={busy && decide.isPending} disabled={decide.isPending} onClick={() => decide.mutate({ doc, decision: { decision: "approved" } })}>
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                aria-label={`Send back ${doc.requirement.label}`}
                disabled={decide.isPending}
                onClick={() => {
                  setNote("");
                  setSendBack(doc);
                }}
              >
                Send back
              </Button>
            </>
          )}
        </div>
        {doc.can_upload && !doc.has_file && <p className="mt-2 text-xs text-slate-500">{DOCUMENT_HINT}</p>}
      </li>
    );
  };

  const section = (title: string, items: FacilityDocument[]) =>
    items.length > 0 && (
      <section aria-label={title} className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <ul className="flex flex-col gap-3">{items.map(renderDocument)}</ul>
      </section>
    );

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Where the documents stand" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-800">
          {summary.required_approved} of {summary.required_total} required documents approved
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={summary.required_total} aria-valuenow={summary.required_approved} aria-label="Required documents approved">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
        </div>
        <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${TONE[banner.tone]}`}>
          {banner.text}
        </p>
        {grace && <p className={`mt-2 rounded-xl border p-3 text-sm ${TONE[grace.tone]}`}>{grace.text}</p>}
        {mode === "facility_admin" && summary.added_not_sent > 0 && (
          <Button type="button" className="mt-3 min-h-[44px]" loading={send.isPending} onClick={() => send.mutate()}>
            Send {summary.added_not_sent} for review
          </Button>
        )}
      </section>

      {section("Required documents", groups.required)}
      {section("If it applies to your facility", groups.ifItApplies)}
      {section("Other documents", groups.optional)}

      <DocumentPreviewModal source={viewing?.source ?? null} title={viewing?.title ?? "Document"} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={Boolean(sendBack)}
        title={`Send back ${sendBack?.requirement.label ?? "document"}`}
        description="Tell the facility what to fix. Their admin will see your note and can replace the document."
        confirmLabel="Send back"
        confirmVariant="primary"
        loading={decide.isPending}
        confirmDisabled={note.trim().length < 3}
        onConfirm={() => {
          if (sendBack) decide.mutate({ doc: sendBack, decision: { decision: "sent_back", note: note.trim() } });
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
            placeholder="For example: The stamp is missing. Please upload the stamped copy."
            className={`mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 placeholder:text-slate-500 ${focusRing}`}
          />
        </label>
      </ConfirmDialog>
    </div>
  );
};

export default FacilityDocumentsPanel;
