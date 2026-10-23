import { describe, expect, it } from "vitest";

import { cleanCode, maskPhone, toDeliveryState } from "../phoneVerification";

describe("cleanCode", () => {
  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
    ["12ab34", "1234"],
    ["1234567890", "123456"],
    ["", ""]
  ])("%s -> %s", (typed, expected) => expect(cleanCode(typed)).toBe(expected));
});

describe("toDeliveryState", () => {
  it("accepts the three states the server sends and treats anything else as none", () => {
    expect(toDeliveryState("pending")).toBe("pending");
    expect(toDeliveryState("sent")).toBe("sent");
    expect(toDeliveryState("failed")).toBe("failed");
    expect(toDeliveryState("none")).toBe("none");
    expect(toDeliveryState("whatever")).toBe("none");
    expect(toDeliveryState(undefined)).toBe("none");
  });
});

describe("maskPhone", () => {
  it("hides the middle of a number", () => expect(maskPhone("+254712345678")).toBe("+254****678"));
  it("says 'your phone' when there is no number", () => expect(maskPhone(null)).toBe("your phone"));
});
