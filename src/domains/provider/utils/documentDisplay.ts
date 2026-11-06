import { itemStatusLabel } from "./onboardingStatus";

/** What a document's state is called to the provider. Uploading is not sending: that is a separate step. */
export const documentStatusLabel = (status: string, sentForReview: boolean): string => {
  if (status === "pending" || status === "submitted") return sentForReview ? "Waiting for review" : "Uploaded";
  return itemStatusLabel(status);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "31 Mar 2027" from a plain date like 2027-03-31, without the time-zone shift that new Date() would add. */
export const formatDocumentDate = (value: string | null | undefined): string | null => {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) return null;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
};

export type ExpiryState = { text: string; tone: "ok" | "soon" | "expired" } | null;

/** How an expiry date reads: plain when far off, a warning inside 30 days, and "Expired" once it has passed. */
export const describeExpiry = (value: string | null | undefined, today: Date = new Date()): ExpiryState => {
  const formatted = formatDocumentDate(value);
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!formatted || !match) return null;
  const end = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((end - now) / 86_400_000);
  if (days < 0) return { text: `Expired ${formatted}`, tone: "expired" };
  if (days <= 30) return { text: `Expires ${formatted}`, tone: "soon" };
  return { text: `Expires ${formatted}`, tone: "ok" };
};

/** Title for a legal document, as the provider knows it. */
export const legalDocumentTitle = (type: string): string => (type === "privacy" ? "Privacy Policy" : type === "terms" ? "Terms of Service" : "Legal document");
