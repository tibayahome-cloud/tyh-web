import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, FileText, ScrollText } from "lucide-react";

import { Loading } from "../../../shared/components/Loading";
import { WidgetError } from "../../../shared/components/WidgetError";
import { useAuth } from "../../../shared/hooks/useAuth";
import { DocumentPreviewModal } from "../components/onboarding/DocumentPreviewModal";
import { useMyApplication, type ApplicationItem } from "../hooks/useMyApplication";
import { useOnboardingStatus } from "../hooks/useOnboardingStatus";
import { describeExpiry, documentStatusLabel, formatDocumentDate, legalDocumentTitle } from "../utils/documentDisplay";

const PILL: Record<string, string> = {
  pending: "bg-sky-100 text-sky-900",
  submitted: "bg-sky-100 text-sky-900",
  verified: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900"
};

const EXPIRY_TONE = { ok: "text-slate-700", soon: "font-medium text-amber-800", expired: "font-medium text-rose-800" } as const;

const linkButton =
  "inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-semibold text-tiba-blue hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50";

const sourceOf = (item: ApplicationItem) => item.download_url ?? item.file_url ?? null;

/** Everything the provider has agreed to, and every document they have sent, in one place. */
const DocumentsPage = () => {
  const { user } = useAuth();
  const applicationQuery = useMyApplication();
  const statusQuery = useOnboardingStatus();
  const [viewing, setViewing] = useState<{ source: string; title: string } | null>(null);

  const legal = user?.legalConsent?.documents ?? [];
  const sentForReview = statusQuery.data?.status === "in_review";

  const { uploaded, needed } = useMemo(() => {
    const items = [...(applicationQuery.data?.items ?? [])].sort(
      (a, b) => (a.requirement_type?.display_order ?? 0) - (b.requirement_type?.display_order ?? 0)
    );
    return {
      uploaded: items.filter((item) => item.status !== "missing"),
      needed: items.filter((item) => item.status === "missing" && item.requirement_type?.required_for_verification)
    };
  }, [applicationQuery.data?.items]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-700">The agreements you have accepted and the documents you have sent us.</p>
      </div>

      <section aria-labelledby="legal-heading" className="space-y-3">
        <h2 id="legal-heading" className="text-base font-semibold text-slate-900">
          Legal documents
        </h2>
        {legal.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">No legal documents to show yet.</p>
        ) : (
          <ul aria-label="Legal documents" className="space-y-2">
            {legal.map((document) => {
              const accepted = formatDocumentDate(document.accepted_at);
              return (
                <li key={`${document.type}-${document.version}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <ScrollText aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <p className="text-base font-medium text-slate-900">{legalDocumentTitle(document.type)}</p>
                      <p className="text-sm text-slate-700">
                        Version {document.version}
                        {document.accepted && accepted ? `, accepted ${accepted}` : document.accepted ? ", accepted" : ", not accepted yet"}
                      </p>
                    </div>
                  </div>
                  {document.public_url && (
                    <a href={document.public_url} target="_blank" rel="noopener noreferrer" className={linkButton} aria-label={`Read ${legalDocumentTitle(document.type)}`}>
                      <Eye aria-hidden="true" size={16} />
                      Read
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="mine-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mine-heading" className="text-base font-semibold text-slate-900">
            Your documents
          </h2>
          <Link to="/pro/onboarding" className={linkButton}>
            Manage on your verification page
          </Link>
        </div>

        {applicationQuery.isPending ? (
          <Loading />
        ) : applicationQuery.isError ? (
          <WidgetError what="your documents" onRetry={() => void applicationQuery.refetch()} />
        ) : uploaded.length === 0 && needed.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-800">You have not sent any documents yet.</p>
            <Link to="/pro/onboarding" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-tiba-blue px-5 text-sm font-semibold text-white hover:opacity-90">
              Add your documents
            </Link>
          </div>
        ) : (
          <>
            {uploaded.length > 0 && (
              <ul aria-label="Documents you have sent" className="space-y-2">
                {uploaded.map((item) => {
                  const label = item.requirement_type?.label ?? "Document";
                  const expiry = describeExpiry(item.expires_on);
                  const source = sourceOf(item);
                  const isText = item.requirement_type?.input_type === "text";
                  return (
                    <li key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />
                          <p className="min-w-0 text-base font-medium text-slate-900">{label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-sm font-medium ${PILL[item.status] ?? "bg-slate-100 text-slate-800"}`}>
                            {documentStatusLabel(item.status, sentForReview)}
                          </span>
                          {source && !isText && (
                            <button type="button" onClick={() => setViewing({ source, title: label })} className={linkButton} aria-label={`View ${label}`}>
                              <Eye aria-hidden="true" size={16} />
                              View
                            </button>
                          )}
                        </div>
                      </div>
                      {isText && item.value_text && <p className="mt-1 pl-8 text-sm text-slate-800">{item.value_text}</p>}
                      {expiry && <p className={`mt-1 pl-8 text-sm ${EXPIRY_TONE[expiry.tone]}`}>{expiry.text}</p>}
                      {item.status === "rejected" && item.comment && (
                        <p role="note" className="mt-2 rounded-lg bg-rose-50 p-2 pl-3 text-sm text-rose-900">
                          <span className="font-semibold">From the reviewer: </span>
                          {item.comment}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {needed.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Still needed</h3>
                <ul aria-label="Documents still needed" className="mt-1 list-inside list-disc text-sm text-slate-800">
                  {needed.map((item) => (
                    <li key={item.id}>{item.requirement_type?.label ?? "Document"}</li>
                  ))}
                </ul>
                <Link to="/pro/onboarding" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-tiba-blue px-5 text-sm font-semibold text-white hover:opacity-90">
                  Add them
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      <DocumentPreviewModal source={viewing?.source ?? null} title={viewing?.title ?? "Document"} onClose={() => setViewing(null)} />
    </div>
  );
};

export default DocumentsPage;
