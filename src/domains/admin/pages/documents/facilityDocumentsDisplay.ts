import type { FacilityDocument, FacilityDocumentStatus, FacilityQueueRow, FacilitySummary } from "./facilityDocumentsApi";

export type Tone = "amber" | "green" | "rose" | "slate" | "blue";

export const FACILITY_STATUS: Record<FacilityDocumentStatus, { label: string; tone: Tone }> = {
  missing: { label: "Not added", tone: "slate" },
  uploaded: { label: "Added, not sent", tone: "blue" },
  submitted: { label: "Waiting for review", tone: "amber" },
  verified: { label: "Approved", tone: "green" },
  rejected: { label: "Sent back", tone: "rose" },
  not_applicable: { label: "Does not apply", tone: "slate" }
};

export type DocumentGroups = { required: FacilityDocument[]; ifItApplies: FacilityDocument[]; optional: FacilityDocument[] };

/** Required first, then the ones that only apply to some facilities, then the rest, each in checklist order. */
export const groupFacilityDocuments = (documents: FacilityDocument[]): DocumentGroups => {
  const byOrder = (a: FacilityDocument, b: FacilityDocument) => a.requirement.display_order - b.requirement.display_order;
  return {
    required: documents.filter((d) => d.requirement.required).sort(byOrder),
    ifItApplies: documents.filter((d) => !d.requirement.required && d.requirement.only_if_offered).sort(byOrder),
    optional: documents.filter((d) => !d.requirement.required && !d.requirement.only_if_offered).sort(byOrder)
  };
};

export type Banner = { tone: Tone; text: string };

/** The one sentence at the top: whose turn it is, in plain words. */
export const summaryBanner = (summary: FacilitySummary, mode: "facility_admin" | "super_admin"): Banner => {
  const who = mode === "super_admin" ? "the facility" : "you";
  if (summary.state === "complete") return { tone: "green", text: "Every required document is approved." };
  if (summary.state === "waiting") {
    return {
      tone: "amber",
      text:
        mode === "super_admin"
          ? `${summary.waiting} ${summary.waiting === 1 ? "document is" : "documents are"} waiting for your review.`
          : `${summary.waiting} ${summary.waiting === 1 ? "document is" : "documents are"} with Tiba Ya Home for review. We will tell you when it is done.`
    };
  }
  if (summary.state === "sent_back") {
    const count = `${summary.sent_back} ${summary.sent_back === 1 ? "document was" : "documents were"} sent back.`;
    return { tone: "rose", text: mode === "super_admin" ? `${count} The facility needs to replace them.` : `${count} Replace them and send again.` };
  }
  if (summary.added_not_sent > 0) return { tone: "blue", text: `Send what ${who} added for review so it can be approved.` };
  return { tone: "slate", text: `Add the required documents, then send them for review.` };
};

export const describeGrace = (summary: FacilitySummary): Banner | null => {
  const days = summary.documents_days_left;
  if (days === null || days === undefined || summary.in_order) return null;
  if (days < 0) return { tone: "rose", text: "The date for having these approved has passed. Add what is missing and send it for review." };
  if (days === 0) return { tone: "amber", text: "Today is the last day to have the required documents approved." };
  return { tone: days <= 14 ? "amber" : "slate", text: `You have ${days} ${days === 1 ? "day" : "days"} to have the required documents approved.` };
};

/** "2 waiting · 3 of 7 required approved" */
export const describeFacilityRow = (row: FacilityQueueRow): string => {
  const parts: string[] = [];
  if (row.waiting) parts.push(`${row.waiting} ${row.waiting === 1 ? "document" : "documents"} waiting`);
  if (row.sent_back) parts.push(`${row.sent_back} sent back`);
  if (row.added_not_sent) parts.push(`${row.added_not_sent} added, not sent`);
  parts.push(`${row.required_approved} of ${row.required_total} required approved`);
  return parts.join(" · ");
};

export const describeFacilityDue = (row: FacilityQueueRow): string | null => {
  if (row.documents_days_left === null || row.documents_days_left === undefined) return null;
  if (row.documents_days_left < 0) return "Documents overdue";
  if (row.documents_days_left === 0) return "Documents due today";
  return `${row.documents_days_left} ${row.documents_days_left === 1 ? "day" : "days"} left`;
};
