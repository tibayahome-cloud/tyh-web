import { describe, expect, it } from "vitest";

import { describeOnboarding, itemStatusLabel, mapOnboardingSummary, type OnboardingSummary } from "../onboardingStatus";

const summary = (overrides: Partial<OnboardingSummary> = {}): OnboardingSummary => ({
  status: "not_started",
  itemsDone: 0,
  itemsTotal: 0,
  items: [],
  nextItem: null,
  reviewerNote: null,
  readyToSubmit: false,
  verifiedAt: null,
  requiredTotal: 0,
  requiredDone: 0,
  documentsDueOn: null,
  documentsDaysLeft: null,
  documentsInOrder: true,
  providerVerified: false,
  ...overrides
});

const item = (label: string) => ({ requirement_key: "k", label, input_type: "file", status: "missing", reviewer_note: null });

describe("describeOnboarding: one plain status for every kind of provider", () => {
  it("not started", () => {
    expect(describeOnboarding(summary())).toMatchObject({ title: "Not started", tone: "neutral" });
  });

  it("documents needed, with which is next (the count is shown beside the progress, not repeated here)", () => {
    expect(describeOnboarding(summary({ status: "documents_needed", itemsDone: 1, itemsTotal: 3, requiredDone: 1, requiredTotal: 3, nextItem: item("Practising licence") }))).toEqual({
      title: "Documents needed",
      message: "Next: Practising licence.",
      tone: "warning"
    });
  });

  it("ready to send once everything is in", () => {
    expect(describeOnboarding(summary({ status: "documents_needed", itemsDone: 3, itemsTotal: 3, readyToSubmit: true }))).toMatchObject({
      title: "Ready to send"
    });
  });

  it("in review", () => {
    expect(describeOnboarding(summary({ status: "in_review" }))).toMatchObject({ title: "In review", tone: "info" });
  });

  it("needs changes, with what the reviewer said, or which document otherwise", () => {
    expect(describeOnboarding(summary({ status: "needs_changes", reviewerNote: "The photo is blurry" })).message).toBe("The photo is blurry");
    expect(describeOnboarding(summary({ status: "needs_changes", nextItem: item("Licence") })).message).toBe("Please replace: Licence.");
  });

  it("verified, and set up by the facility, are never shown as not started", () => {
    expect(describeOnboarding(summary({ status: "verified" })).title).toBe("You are verified");
    const facility = describeOnboarding(summary({ status: "set_up_by_facility" }));
    expect(facility.title).toBe("Your facility set you up");
    expect(facility.message).not.toMatch(/initializ|0%/i);
  });
});

describe("mapOnboardingSummary", () => {
  it("treats a status it does not know as not started rather than guessing", () => {
    expect(mapOnboardingSummary({ status: "something_new" }).status).toBe("not_started");
  });

  it("reads the server's counts and flags", () => {
    expect(mapOnboardingSummary({ status: "documents_needed", items_done: 2, items_total: 5, ready_to_submit: false })).toMatchObject({
      status: "documents_needed",
      itemsDone: 2,
      itemsTotal: 5,
      readyToSubmit: false
    });
  });
});

describe("itemStatusLabel", () => {
  it("never prints the raw status", () => {
    expect(itemStatusLabel("rejected")).toBe("Sent back");
    expect(itemStatusLabel("pending")).toBe("Sent, waiting for review");
    expect(itemStatusLabel("missing")).toBe("Needed");
    expect(itemStatusLabel("verified")).toBe("Approved");
    expect(itemStatusLabel("under_review_x")).toBe("In progress");
  });
});

describe("documents owed by a provider who was already working", () => {
  it("leads with what is owed and the days left, ahead of 'you are verified'", () => {
    const copy = describeOnboarding(
      summary({ status: "verified", documentsInOrder: false, documentsDaysLeft: 12, requiredTotal: 4, nextItem: item("National ID") })
    );
    expect(copy.title).toBe("Add your documents to keep taking bookings");
    expect(copy.message).toBe("Upload the required documents in 12 days. Next: National ID. You can keep working until then.");
    expect(copy.tone).toBe("warning");
  });

  it("is quiet when nothing is owed, and an older server that sends nothing means nothing is owed", () => {
    expect(describeOnboarding(summary({ status: "verified" })).title).toBe("You are verified");
    expect(mapOnboardingSummary({ status: "verified" }).documentsInOrder).toBe(true);
  });

  it("counts required documents against the server's total and never shows more done than total", () => {
    const mapped = mapOnboardingSummary({
      status: "documents_needed",
      required_total: 2,
      items: [
        { label: "A", status: "verified", required: true },
        { label: "B", status: "pending", required: true },
        { label: "C", status: "pending", required: true },
        { label: "D", status: "missing", required: false }
      ]
    });
    expect(mapped.requiredTotal).toBe(2);
    expect(mapped.requiredDone).toBe(2);
  });
});
