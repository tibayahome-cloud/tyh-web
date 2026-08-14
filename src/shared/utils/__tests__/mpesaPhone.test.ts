import { describe, expect, it } from "vitest";

import { isValidMpesaPhone, mpesaPhoneValidationError, normalizeMpesaPhone } from "../mpesaPhone";

describe("normalizeMpesaPhone", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["0112345678", "254112345678"],
    ["+254712345678", "254712345678"],
    ["254712345678", "254712345678"],
    ["0712 345 678", "254712345678"],
    ["0712-345-678", "254712345678"]
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeMpesaPhone(input)).toBe(expected);
  });

  it.each([
    ["", null],
    ["0712345", null], // too short
    ["07123456789", null], // too long
    ["0212345678", null], // not a Safaricom prefix (0/1/7 only)
    ["+1 555 123 4567", null], // not a Kenyan number
    ["not a phone", null]
  ])("rejects %s", (input, expected) => {
    expect(normalizeMpesaPhone(input)).toBe(expected);
  });
});

describe("isValidMpesaPhone", () => {
  it("matches normalizeMpesaPhone's judgment", () => {
    expect(isValidMpesaPhone("0712345678")).toBe(true);
    expect(isValidMpesaPhone("not a phone")).toBe(false);
  });
});

describe("mpesaPhoneValidationError", () => {
  it("asks for a number when the field is empty", () => {
    expect(mpesaPhoneValidationError("")).toMatch(/required/i);
    expect(mpesaPhoneValidationError("   ")).toMatch(/required/i);
  });

  it("flags an unusable number distinctly from a missing one", () => {
    expect(mpesaPhoneValidationError("12345")).toMatch(/valid/i);
  });

  it("passes a well-formed number", () => {
    expect(mpesaPhoneValidationError("0712345678")).toBeNull();
  });
});
