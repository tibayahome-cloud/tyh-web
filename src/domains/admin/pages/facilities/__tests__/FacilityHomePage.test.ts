import { describe, expect, it } from "vitest";

import { resolveFacilityWorkspaceRoute } from "../FacilityHomePage";
import type { Facility } from "../../../../../shared/schemas/facility";

const facility = (id: string): Facility => ({ id } as Facility);

describe("FacilityHomePage helpers", () => {
  it("routes a single scoped facility to its workspace", () => {
    expect(resolveFacilityWorkspaceRoute([facility("facility-1")])).toEqual({
      kind: "workspace",
      to: "/admin/facilities/facility-1"
    });
  });

  it("offers a choice only when the API returns more than one facility", () => {
    expect(resolveFacilityWorkspaceRoute([facility("facility-1"), facility("facility-2")])).toEqual({
      kind: "select",
      options: [
        { id: "facility-1", to: "/admin/facilities/facility-1" },
        { id: "facility-2", to: "/admin/facilities/facility-2" }
      ]
    });
  });

  it("only ever links to facilities the API returned", () => {
    const result = resolveFacilityWorkspaceRoute([facility("a"), facility("b"), facility("c")]);
    expect(result.kind === "select" && result.options.map((option) => option.id)).toEqual(["a", "b", "c"]);
  });

  it("shows an empty state when no facility is linked", () => {
    expect(resolveFacilityWorkspaceRoute([])).toEqual({ kind: "empty" });
  });
});
