import { describe, expect, it } from "vitest";

import type { ChecklistItem } from "../../components/onboarding/OnboardingChecklist";
import { timelineStates } from "../../components/onboarding/OnboardingTimeline";
import { groupChecklistItems, itemsLeft } from "../onboardingGroups";
import { mapOnboardingSummary } from "../onboardingStatus";

const item = (id: string, key: string | null, overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  requirementKey: key,
  label: id,
  inputType: "file",
  status: "missing",
  valueText: null,
  hasFile: false,
  reviewerNote: null,
  required: true,
  hasExpiry: false,
  expiresOn: null,
  ...overrides
});

describe("grouping documents", () => {
  it("puts each known document in its group, in order, and the rest under other documents", () => {
    const groups = groupChecklistItems([item("a", "practising-licence"), item("b", "national-id"), item("c", "something-new"), item("d", "payout-details")]);
    expect(groups.map((g) => g.group.id)).toEqual(["identity", "professional", "payments", "other"]);
    expect(groups.find((g) => g.group.id === "other")?.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("leaves out groups that have nothing in them", () => {
    expect(groupChecklistItems([item("a", "cv")]).map((g) => g.group.id)).toEqual(["professional"]);
  });

  it("counts only required documents that have not been sent as left", () => {
    expect(
      itemsLeft([
        item("a", "national-id"),
        item("b", "kra-pin", { status: "pending" }),
        item("c", "cv", { required: false }),
        item("d", "good-conduct", { status: "rejected" })
      ])
    ).toBe(2);
  });
});

describe("the verification timeline", () => {
  const at = (raw: Record<string, unknown>) => timelineStates(mapOnboardingSummary(raw));

  it("starts at adding documents, then sending, then waiting for the check", () => {
    expect(at({ status: "not_started" })).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(at({ status: "documents_needed", ready_to_submit: false })).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(at({ status: "documents_needed", ready_to_submit: true })).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(at({ status: "in_review" })).toEqual(["done", "done", "current", "upcoming"]);
  });

  it("flags the first step when something was sent back, and finishes when verified", () => {
    expect(at({ status: "needs_changes" })[0]).toBe("attention");
    expect(at({ status: "verified" })).toEqual(["done", "done", "done", "done"]);
  });
});
