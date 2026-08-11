export type LegalDocumentType = "terms" | "privacy";

export type LegalDocumentManifestEntry = {
  type: LegalDocumentType;
  version: string;
  effectiveDate: string;
  title: string;
  actionLabel: string;
  url: string;
  contentSha256: string;
};

export const CURRENT_LEGAL_DOCUMENTS: LegalDocumentManifestEntry[] = [
  {
    type: "terms",
    version: "v1.0",
    effectiveDate: "2026-08-11",
    title: "Terms of Service",
    actionLabel: "I agree to the Terms of Service.",
    url: "/legal/terms-of-service-v1.0.pdf",
    contentSha256: "ec64172b3168f762d535acc2816db6fc222c4461191324a1675b4e323b6ece91"
  },
  {
    type: "privacy",
    version: "v1.0",
    effectiveDate: "2026-08-11",
    title: "Privacy Policy",
    actionLabel: "I acknowledge the Privacy Policy.",
    url: "/legal/privacy-policy-v1.0.pdf",
    contentSha256: "3266a97ff1bbec71c873ff846de491282ae7fd0a9372dfbb5710702576d166aa"
  }
];

export const currentLegalDocumentPayload = () =>
  CURRENT_LEGAL_DOCUMENTS.map((document) => ({
    type: document.type,
    version: document.version
  }));
