import { describe, expect, it } from "vitest";

import { sortSpecialistFirst } from "../telemedicineCatalogOrdering";

describe("sortSpecialistFirst", () => {
  it("places specialist groups before general groups", () => {
    const groups = [
      { key: "general-medicine", name: "General Medicine", displayOrder: 0 },
      { key: "specialist-care", name: "Specialist Care", displayOrder: 10 },
      { key: "mental-health", name: "Mental Health", displayOrder: 1 }
    ];

    expect(sortSpecialistFirst(groups).map((group) => group.name)).toEqual([
      "Specialist Care",
      "General Medicine",
      "Mental Health"
    ]);
  });

  it("preserves configured order when no specialist group exists", () => {
    const groups = [
      { key: "mental-health", name: "Mental Health", displayOrder: 2 },
      { key: "general-medicine", name: "General Medicine", displayOrder: 1 }
    ];

    expect(sortSpecialistFirst(groups).map((group) => group.name)).toEqual([
      "General Medicine",
      "Mental Health"
    ]);
  });
});
