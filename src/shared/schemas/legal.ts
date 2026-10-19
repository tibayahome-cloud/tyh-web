import type { LegalDocumentType } from "../constants/legal";

export type LegalConsentDocument = {
  type: LegalDocumentType;
  version: string;
  effective_at?: string;
  public_url?: string;
  content_sha256?: string;
  accepted: boolean;
  accepted_at?: string | null;
};

export type LegalConsentSummary = {
  required: boolean;
  complete: boolean;
  documents: LegalConsentDocument[];
};

const isLegalDocumentType = (value: unknown): value is LegalDocumentType =>
  value === "terms" || value === "privacy";

export const mapLegalConsentSummary = (input: unknown): LegalConsentSummary | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const source = input as Record<string, unknown>;
  const rawDocuments = Array.isArray(source.documents) ? source.documents : [];
  const documents = rawDocuments
    .map((item): LegalConsentDocument | null => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const raw = item as Record<string, unknown>;
      if (!isLegalDocumentType(raw.type) || typeof raw.version !== "string") {
        return null;
      }
      return {
        type: raw.type,
        version: raw.version,
        ...(typeof raw.effective_at === "string" ? { effective_at: raw.effective_at } : {}),
        ...(typeof raw.public_url === "string" ? { public_url: raw.public_url } : {}),
        ...(typeof raw.content_sha256 === "string" ? { content_sha256: raw.content_sha256 } : {}),
        accepted: Boolean(raw.accepted),
        accepted_at: typeof raw.accepted_at === "string" ? raw.accepted_at : null
      };
    })
    .filter((item): item is LegalConsentDocument => item !== null);

  return {
    required: Boolean(source.required),
    complete: Boolean(source.complete),
    documents
  };
};

export const legalConsentIsComplete = (summary: LegalConsentSummary | null | undefined) =>
  !summary?.required || summary.complete;
