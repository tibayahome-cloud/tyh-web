import { AlertCircle, CheckCircle2, FileText, Maximize2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { CURRENT_LEGAL_DOCUMENTS } from "../constants/legal";
import type { LegalDocumentManifestEntry } from "../constants/legal";
import { useAuth } from "../hooks/useAuth";
import type { LegalConsentDocument } from "../schemas/legal";
import { Button } from "./Button";
import { Card } from "./Card";
import { Modal } from "./Modal";

type LegalDocumentLinksProps = {
  className?: string;
  acceptedBy?: string | null;
  consentDocuments?: LegalConsentDocument[] | null;
};

const formatAcceptedDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
};

export const LegalDocumentLinks = ({
  className = "",
  acceptedBy,
  consentDocuments
}: LegalDocumentLinksProps) => {
  const location = useLocation();
  const [previewDocument, setPreviewDocument] = useState<LegalDocumentManifestEntry | null>(null);

  return (
    <div className={`space-y-3 ${className}`}>
      <Modal
        open={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        title={previewDocument?.title}
        maxWidth="lg"
      >
        {previewDocument && (
          <div className="space-y-3">
            <iframe
              key={previewDocument.url}
              src={previewDocument.url}
              title={previewDocument.title}
              className="h-[70vh] w-full rounded-lg border border-slate-200"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(previewDocument.url, "_blank", "noopener,noreferrer")}
              >
                <Maximize2 className="h-4 w-4" />
                Enlarge
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {CURRENT_LEGAL_DOCUMENTS.map((document) => {
        const consent = consentDocuments?.find(
          (item) => item.type === document.type && item.version === document.version
        );
        const statusKnown = Array.isArray(consentDocuments);
        const accepted = Boolean(consent?.accepted);
        const acceptedDate = formatAcceptedDate(consent?.accepted_at);
        const signer = acceptedBy?.trim() || "this account";
        const statusLabel = accepted ? "Completed" : statusKnown ? "Pending" : "Status unavailable";
        const statusClass = accepted
          ? "bg-emerald-50 text-emerald-700"
          : statusKnown
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-600";
        const StatusIcon = accepted ? CheckCircle2 : AlertCircle;

        return (
          <div
            key={document.type}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tiba-blue/10 text-tiba-blue">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">{document.title}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {accepted
                    ? `Accepted by ${signer}${acceptedDate ? ` on ${acceptedDate}` : ""}`
                    : statusKnown
                      ? `Not accepted for this account. ${document.version} effective ${document.effectiveDate}`
                      : `${document.version} effective ${document.effectiveDate}`}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}
              >
                <StatusIcon className="h-4 w-4" />
                {statusLabel}
              </span>
              <span className="flex items-center gap-3">
                {!accepted && statusKnown && (
                  <Link
                    to="/legal/consent"
                    state={{ from: location }}
                    className="text-sm font-bold text-tiba-blue hover:underline"
                  >
                    Review &amp; accept
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewDocument(document)}
                  className="text-sm font-semibold text-slate-500 hover:text-tiba-blue"
                >
                  View document
                </button>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const LegalDocumentsPanel = () => {
  const { user } = useAuth();

  return (
    <Card
      title="Legal documents"
      description="Review the current Terms of Service and Privacy Policy used by Tiba Ya Home."
    >
      <LegalDocumentLinks
        acceptedBy={user?.fullName}
        consentDocuments={user?.legalConsent?.documents ?? null}
      />
    </Card>
  );
};

export default LegalDocumentsPanel;
