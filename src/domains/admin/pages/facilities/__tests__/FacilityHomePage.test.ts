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

  it("fails closed when multiple facilities are returned for admin ops", () => {
    expect(resolveFacilityWorkspaceRoute([facility("facility-1"), facility("facility-2")])).toEqual({
      kind: "scope_error"
    });
  });

  it("shows an empty state when no facility is linked", () => {
    expect(resolveFacilityWorkspaceRoute([])).toEqual({ kind: "empty" });
  });
});
