import { ExternalLink, FileText } from "lucide-react";

import { CURRENT_LEGAL_DOCUMENTS } from "../constants/legal";
import { Card } from "./Card";

type LegalDocumentLinksProps = {
  className?: string;
};

export const LegalDocumentLinks = ({ className = "" }: LegalDocumentLinksProps) => (
  <div className={`space-y-3 ${className}`}>
    {CURRENT_LEGAL_DOCUMENTS.map((document) => (
      <a
        key={document.type}
        href={document.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-tiba-blue hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tiba-blue/10 text-tiba-blue">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-900">{document.title}</span>
            <span className="block text-xs text-slate-500">
              {document.version} effective {document.effectiveDate}
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-tiba-blue">
          Open PDF
          <ExternalLink className="h-4 w-4" />
        </span>
      </a>
    ))}
  </div>
);

export const LegalDocumentsPanel = () => (
  <Card
    title="Legal documents"
    description="Review the current Terms of Service and Privacy Policy used by Tiba Ya Home."
  >
    <LegalDocumentLinks />
  </Card>
);

export default LegalDocumentsPanel;
