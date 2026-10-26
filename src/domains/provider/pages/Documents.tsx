import { ScrollText, Eye } from "lucide-react";

import { useAuth } from "../../../shared/hooks/useAuth";
import { VerificationPanel } from "../components/onboarding/VerificationPanel";
import { formatDocumentDate, legalDocumentTitle } from "../utils/documentDisplay";

const linkButton =
  "inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-semibold text-tiba-blue hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50";

/**
 * One place for every document: what we need from the provider (add, replace, remove and send, all here), and the legal
 * agreements they have accepted. Nothing sends them to another page to change a document.
 */
const DocumentsPage = () => {
  const { user } = useAuth();
  const legal = user?.legalConsent?.documents ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-700">What we need from you so clients can trust who they book, and the agreements you have accepted.</p>
      </div>

      <VerificationPanel />

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
    </div>
  );
};

export default DocumentsPage;
