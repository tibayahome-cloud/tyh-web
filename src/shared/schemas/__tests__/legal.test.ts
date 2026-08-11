import { describe, expect, it } from "vitest";

import { CURRENT_LEGAL_DOCUMENTS, currentLegalDocumentPayload } from "../../constants/legal";
import { mapLegalConsentSummary } from "../legal";

describe("legal consent contracts", () => {
  it("uses the approved v1 document manifest", () => {
    expect(currentLegalDocumentPayload()).toEqual([
      { type: "terms", version: "v1.0" },
      { type: "privacy", version: "v1.0" }
    ]);
    expect(CURRENT_LEGAL_DOCUMENTS.find((document) => document.type === "terms")?.contentSha256).toBe(
      "ec64172b3168f762d535acc2816db6fc222c4461191324a1675b4e323b6ece91"
    );
    expect(CURRENT_LEGAL_DOCUMENTS.find((document) => document.type === "privacy")?.contentSha256).toBe(
      "3266a97ff1bbec71c873ff846de491282ae7fd0a9372dfbb5710702576d166aa"
    );
  });

  it("maps backend legal consent summaries defensively", () => {
    const summary = mapLegalConsentSummary({
      required: true,
      complete: false,
      documents: [
        {
          type: "terms",
          version: "v1.0",
          accepted: true,
          accepted_at: "2026-08-11T10:00:00+00:00"
        },
        { type: "privacy", version: "v1.0", accepted: false }
      ]
    });

    expect(summary?.required).toBe(true);
    expect(summary?.complete).toBe(false);
    expect(summary?.documents).toHaveLength(2);
    expect(summary?.documents[0]).toMatchObject({
      type: "terms",
      accepted: true,
      accepted_at: "2026-08-11T10:00:00+00:00"
    });
    expect(summary?.documents[1]).toMatchObject({ type: "privacy", accepted: false });
  });
});
