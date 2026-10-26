import { describe, expect, it } from "vitest";

import { canApproveApplication } from "../applicationApproval";

const item = (status: string, required: boolean) => ({ status, requirement_type: { required_for_verification: required } });

describe("when an application can be approved", () => {
  it("needs every required document verified", () => {
    expect(canApproveApplication([item("verified", true), item("verified", true)])).toBe(true);
    expect(canApproveApplication([item("verified", true), item("pending", true)])).toBe(false);
    expect(canApproveApplication([item("verified", true), item("missing", true)])).toBe(false);
  });

  it("is not held up by an optional document nobody uploaded", () => {
    expect(canApproveApplication([item("verified", true), item("missing", false)])).toBe(true);
  });

  it("does hold approval for an optional document that was sent and not yet checked, or sent back", () => {
    expect(canApproveApplication([item("verified", true), item("pending", false)])).toBe(false);
    expect(canApproveApplication([item("verified", true), item("rejected", false)])).toBe(false);
  });

  it("is never true for an application with nothing on it", () => {
    expect(canApproveApplication([])).toBe(false);
  });
});
