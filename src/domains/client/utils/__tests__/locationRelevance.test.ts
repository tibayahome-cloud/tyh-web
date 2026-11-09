import { describe, expect, it } from "vitest";

import { shouldAskForLocation } from "../locationRelevance";

describe("shouldAskForLocation", () => {
  it("does not ask a client who has only video consultations", () => {
    expect(shouldAskForLocation([{ isTelemedicine: true }, undefined])).toBe(false);
  });

  it("does not ask a client with nothing booked", () => {
    expect(shouldAskForLocation([undefined, undefined])).toBe(false);
    expect(shouldAskForLocation([])).toBe(false);
  });

  it("asks while an in-person booking is active or being matched", () => {
    expect(shouldAskForLocation([{ isTelemedicine: false }, undefined])).toBe(true);
    expect(shouldAskForLocation([{ isTelemedicine: true }, { isTelemedicine: false }])).toBe(true);
  });
});
