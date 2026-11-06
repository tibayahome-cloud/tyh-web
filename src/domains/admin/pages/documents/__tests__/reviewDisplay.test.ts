import { describe, expect, it } from "vitest";

import type { ReviewItem, ReviewRow } from "../reviewApi";
import { describeDue, describeItem, describeRow, requiredProgress, splitItems } from "../reviewDisplay";

const row = (overrides: Partial<ReviewRow> = {}): ReviewRow => ({
  application_id: "a1",
  provider_user_id: "u1",
  provider_name: "Dr Test",
  facility_id: "f1",
  facility_name: "Test Clinic",
  provider_verified: false,
  application_status: "submitted",
  state: "waiting",
  waiting: 0,
  sent_back: 0,
  missing_required: 0,
  approved: 0,
  required_total: 0,
  submitted_at: null,
  documents_due_on: null,
  documents_days_left: null,
  ...overrides
});

const item = (id: string, status: string, required: boolean, order = 0): ReviewItem => ({
  id,
  status,
  requirement_type: { id: `r${id}`, label: `Doc ${id}`, input_type: "file", display_order: order, required_for_verification: required }
});

describe("describeRow", () => {
  it("says what waits, what was sent back, and how far the required list is", () => {
    const text = describeRow(row({ waiting: 2, sent_back: 1, missing_required: 0, required_total: 5 }));
    expect(text).toBe("2 documents waiting · 1 sent back · 2 of 5 required approved");
  });

  it("uses the singular for one document", () => {
    expect(describeRow(row({ waiting: 1, required_total: 3, missing_required: 2 }))).toContain("1 document waiting");
  });

  it("falls back to a plain line when there is nothing yet", () => {
    expect(describeRow(row())).toBe("No documents yet");
  });
});

describe("describeDue", () => {
  it("is silent without a date", () => expect(describeDue(row())).toBeNull());
  it("reads days left, today and overdue", () => {
    expect(describeDue(row({ documents_days_left: 12 }))).toBe("12 days left");
    expect(describeDue(row({ documents_days_left: 1 }))).toBe("1 day left");
    expect(describeDue(row({ documents_days_left: 0 }))).toBe("Documents due today");
    expect(describeDue(row({ documents_days_left: -3 }))).toBe("Documents overdue");
  });
});

describe("describeItem", () => {
  it("lets the reviewer decide only on a provided document the provider has sent", () => {
    expect(describeItem(item("1", "pending", true), "submitted")).toMatchObject({ label: "Waiting for your review", canDecide: true });
    expect(describeItem(item("1", "pending", true), "approved").canDecide).toBe(true);
  });

  it("does not offer a decision while the provider is still editing", () => {
    for (const status of ["draft", "under_review"]) {
      expect(describeItem(item("1", "pending", true), status)).toMatchObject({ label: "Not sent yet", canDecide: false });
    }
  });

  it("names the settled states without colour alone", () => {
    expect(describeItem(item("1", "verified", true), "submitted").label).toBe("Approved");
    expect(describeItem(item("1", "rejected", true), "under_review").label).toBe("Sent back");
    expect(describeItem(item("1", "missing", true), "submitted")).toMatchObject({ label: "Not added", canDecide: false });
  });
});

describe("required progress and ordering", () => {
  const items = [item("c", "pending", false, 3), item("b", "verified", true, 2), item("a", "pending", true, 1)];

  it("counts only required documents", () => {
    expect(requiredProgress(items)).toEqual({ approved: 1, total: 2 });
  });

  it("lists required documents first, each in checklist order", () => {
    const { required, other } = splitItems(items);
    expect(required.map((i) => i.id)).toEqual(["a", "b"]);
    expect(other.map((i) => i.id)).toEqual(["c"]);
  });
});
