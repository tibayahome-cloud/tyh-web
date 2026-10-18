import { describe, expect, it } from "vitest";

import { buildFieldParams, providerProfile } from "../fieldInclude";

describe("provider profile field request", () => {
  it("asks for the user's status, so the account state can be shown", () => {
    const include = buildFieldParams(providerProfile).include ?? "";
    expect(include).toMatch(/user:[^,]*(,[^:,]*)*\bstatus\b/);
  });
});
