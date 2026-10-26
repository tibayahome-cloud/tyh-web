import { describe, expect, it } from "vitest";

import { describeExpiry, documentStatusLabel, formatDocumentDate, legalDocumentTitle } from "../documentDisplay";

describe("document dates", () => {
  it("writes a plain date without shifting the day", () => {
    expect(formatDocumentDate("2027-03-31")).toBe("31 Mar 2027");
    expect(formatDocumentDate("2026-03-05T09:00:00+00:00")).toBe("5 Mar 2026");
    expect(formatDocumentDate(null)).toBeNull();
    expect(formatDocumentDate("soon")).toBeNull();
  });

  it("marks an expiry as far off, close, or past", () => {
    const today = new Date(2026, 9, 26);
    expect(describeExpiry("2027-03-31", today)).toEqual({ text: "Expires 31 Mar 2027", tone: "ok" });
    expect(describeExpiry("2026-11-10", today)?.tone).toBe("soon");
    expect(describeExpiry("2026-10-26", today)?.tone).toBe("soon");
    expect(describeExpiry("2026-10-25", today)).toEqual({ text: "Expired 25 Oct 2026", tone: "expired" });
    expect(describeExpiry(null, today)).toBeNull();
  });
});

describe("document wording", () => {
  it("says uploaded until the application has been sent", () => {
    expect(documentStatusLabel("pending", false)).toBe("Uploaded");
    expect(documentStatusLabel("pending", true)).toBe("Waiting for review");
    expect(documentStatusLabel("verified", false)).toBe("Approved");
    expect(documentStatusLabel("rejected", true)).toBe("Sent back");
  });

  it("names the legal documents", () => {
    expect(legalDocumentTitle("terms")).toBe("Terms of Service");
    expect(legalDocumentTitle("privacy")).toBe("Privacy Policy");
  });
});
