import { describe, expect, it } from "vitest";

import type { FacilityDocument, FacilityQueueRow, FacilitySummary } from "../facilityDocumentsApi";
import { describeFacilityDue, describeFacilityRow, describeGrace, groupFacilityDocuments, summaryBanner } from "../facilityDocumentsDisplay";

const doc = (key: string, order: number, requirement: Partial<FacilityDocument["requirement"]> = {}): FacilityDocument => ({
  id: key,
  status: "missing",
  expires_on: null,
  comment: null,
  has_file: false,
  download_url: null,
  filename: null,
  submitted_at: null,
  verified_at: null,
  can_upload: true,
  requirement: { id: `r-${key}`, key, label: key, description: null, required: false, only_if_offered: false, has_expiry: false, super_admin_uploads: false, display_order: order, ...requirement }
});

const summary = (overrides: Partial<FacilitySummary> = {}): FacilitySummary => ({
  state: "incomplete",
  required_total: 7,
  required_approved: 2,
  waiting: 0,
  sent_back: 0,
  added_not_sent: 0,
  missing_required: 5,
  in_order: false,
  documents_due_on: null,
  documents_days_left: null,
  ...overrides
});

describe("groupFacilityDocuments", () => {
  it("lists required documents first, then the ones that only apply to some facilities, then the rest", () => {
    const groups = groupFacilityDocuments([
      doc("kra", 3),
      doc("pharmacy", 6, { only_if_offered: true }),
      doc("cr12", 2, { required: true }),
      doc("registration", 1, { required: true })
    ]);

    expect(groups.required.map((d) => d.id)).toEqual(["registration", "cr12"]);
    expect(groups.ifItApplies.map((d) => d.id)).toEqual(["pharmacy"]);
    expect(groups.optional.map((d) => d.id)).toEqual(["kra"]);
  });
});

describe("summaryBanner", () => {
  it("says whose turn it is in plain words for each person", () => {
    expect(summaryBanner(summary({ state: "waiting", waiting: 2 }), "facility_admin").text).toContain("with Tiba Ya Home for review");
    expect(summaryBanner(summary({ state: "waiting", waiting: 1 }), "super_admin").text).toBe("1 document is waiting for your review.");
    expect(summaryBanner(summary({ state: "sent_back", sent_back: 1 }), "facility_admin").text).toBe("1 document was sent back. Replace them and send again.");
    expect(summaryBanner(summary({ state: "sent_back", sent_back: 2 }), "super_admin").text).toBe("2 documents were sent back. The facility needs to replace them.");
    expect(summaryBanner(summary({ state: "complete" }), "facility_admin").tone).toBe("green");
    expect(summaryBanner(summary({ added_not_sent: 1 }), "facility_admin").text).toContain("Send what you added");
    expect(summaryBanner(summary(), "facility_admin").text).toContain("Add the required documents");
  });
});

describe("describeGrace", () => {
  it("counts down while documents are owed, and goes quiet once they are in order", () => {
    expect(describeGrace(summary({ documents_days_left: 30 }))?.text).toBe("You have 30 days to have the required documents approved.");
    expect(describeGrace(summary({ documents_days_left: 1 }))?.text).toBe("You have 1 day to have the required documents approved.");
    expect(describeGrace(summary({ documents_days_left: 10 }))?.tone).toBe("amber");
    expect(describeGrace(summary({ documents_days_left: 0 }))?.text).toContain("last day");
    expect(describeGrace(summary({ documents_days_left: -2 }))?.tone).toBe("rose");
    expect(describeGrace(summary({ documents_days_left: null }))).toBeNull();
    expect(describeGrace(summary({ documents_days_left: 5, in_order: true }))).toBeNull();
  });
});

describe("queue rows", () => {
  const row = (overrides: Partial<FacilityQueueRow> = {}): FacilityQueueRow => ({
    ...summary(),
    facility_id: "f1",
    facility_name: "Example Clinic",
    facility_status: "active",
    oldest_submitted_at: null,
    ...overrides
  });

  it("reads what waits, what was sent back and how far the required list is", () => {
    expect(describeFacilityRow(row({ waiting: 2, sent_back: 1, added_not_sent: 1, required_approved: 3 }))).toBe(
      "2 documents waiting · 1 sent back · 1 added, not sent · 3 of 7 required approved"
    );
    expect(describeFacilityRow(row({ waiting: 1 }))).toContain("1 document waiting");
  });

  it("names the due date only when there is one", () => {
    expect(describeFacilityDue(row())).toBeNull();
    expect(describeFacilityDue(row({ documents_days_left: 9 }))).toBe("9 days left");
    expect(describeFacilityDue(row({ documents_days_left: 0 }))).toBe("Documents due today");
    expect(describeFacilityDue(row({ documents_days_left: -1 }))).toBe("Documents overdue");
  });
});
