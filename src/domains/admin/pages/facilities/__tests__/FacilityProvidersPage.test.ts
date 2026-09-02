import { describe, expect, it } from "vitest";

import { accountStatusTone } from "../FacilityProvidersPage";

describe("accountStatusTone", () => {
  it("marks an active account as on", () => {
    expect(accountStatusTone("active")).toBe("on");
  });

  it("marks a suspended account as blocked rather than merely off", () => {
    // Suspended is not the same as "switched off" -- it needs to read as a problem.
    expect(accountStatusTone("suspended")).toBe("suspended");
  });

  it("treats a pending or unknown status as needing action", () => {
    expect(accountStatusTone("pending")).toBe("pending");
    expect(accountStatusTone(undefined)).toBe("pending");
    expect(accountStatusTone(null)).toBe("pending");
  });
});
