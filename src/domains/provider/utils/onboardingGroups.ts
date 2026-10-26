import type { ChecklistItem } from "../components/onboarding/OnboardingChecklist";

export type DocumentGroupId = "identity" | "professional" | "payments" | "other";

export type DocumentGroup = {
  id: DocumentGroupId;
  title: string;
  description: string;
  keys: string[];
};

/** How the documents are grouped for the provider. Anything not listed lands in "Other documents". */
export const DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    id: "identity",
    title: "Your identity",
    description: "So clients and our team know who you are.",
    keys: ["national-id", "passport-photo", "kra-pin", "proof-of-residence", "good-conduct"]
  },
  {
    id: "professional",
    title: "Your professional standing",
    description: "Your registration, licence and training.",
    keys: [
      "professional-registration",
      "practising-licence",
      "academic-certificates",
      "specialisation-certificates",
      "professional-indemnity",
      "cv"
    ]
  },
  {
    id: "payments",
    title: "Payments and agreements",
    description: "Where we send your earnings, and what you agree to.",
    keys: ["payout-details", "contractor-agreement", "confidentiality-consent"]
  }
];

const OTHER: DocumentGroup = { id: "other", title: "Other documents", description: "Anything else we have asked for.", keys: [] };

export type GroupedItems = { group: DocumentGroup; items: ChecklistItem[] };

const PROVIDED = new Set(["pending", "submitted", "verified"]);

/** Items that still hold up verification: required, and not yet sent. */
export const itemsLeft = (items: ChecklistItem[]): number =>
  items.filter((item) => item.required && !PROVIDED.has(item.status)).length;

export const groupChecklistItems = (items: ChecklistItem[]): GroupedItems[] => {
  const placed = new Set<string>();
  const result: GroupedItems[] = DOCUMENT_GROUPS.map((group) => {
    const inGroup = items.filter((item) => item.requirementKey && group.keys.includes(item.requirementKey));
    inGroup.forEach((item) => placed.add(item.id));
    return { group, items: inGroup };
  });
  const rest = items.filter((item) => !placed.has(item.id));
  if (rest.length > 0) result.push({ group: OTHER, items: rest });
  return result.filter((entry) => entry.items.length > 0);
};
