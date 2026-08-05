import { describe, expect, it } from "vitest";

import { buildServiceRequestInput, validateServiceRequestForm } from "../FacilityWorkspacePage";

describe("facility service request form", () => {
  it("requires a proposed name and rationale", () => {
    expect(
      validateServiceRequestForm({ proposedName: "", rationale: "Clients keep asking.", proposedCategoryName: "" })
    ).toBe("Enter the service name you want added.");

    expect(
      validateServiceRequestForm({ proposedName: "IV Therapy", rationale: "  ", proposedCategoryName: "" })
    ).toBe("Explain why this service is needed.");

    expect(
      validateServiceRequestForm({
        proposedName: "IV Therapy",
        rationale: "Clients keep asking for at-home IV drips.",
        proposedCategoryName: ""
      })
    ).toBeNull();
  });

  it("builds a trimmed create payload and omits an empty category suggestion", () => {
    const input = buildServiceRequestInput({
      proposedName: "  IV Therapy  ",
      rationale: "  Clients keep asking for at-home IV drips.  ",
      proposedCategoryName: "  "
    });

    expect(input).toEqual({
      proposedName: "IV Therapy",
      rationale: "Clients keep asking for at-home IV drips.",
      proposedCategoryName: null
    });
  });

  it("keeps a provided category suggestion trimmed", () => {
    const input = buildServiceRequestInput({
      proposedName: "IV Therapy",
      rationale: "Clients keep asking for at-home IV drips.",
      proposedCategoryName: "  Wellness  "
    });

    expect(input.proposedCategoryName).toBe("Wellness");
  });
});
