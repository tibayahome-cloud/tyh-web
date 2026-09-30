import { describe, expect, it } from "vitest";

import { formatMsisdn, hasUsableSavedNumber, resolvePayer } from "../payerPhone";

describe("formatMsisdn", () => {
  it("writes a normalised number the way people say it", () => {
    expect(formatMsisdn("254712345678")).toBe("0712 345 678");
    expect(formatMsisdn("254112345678")).toBe("0112 345 678");
  });
});

describe("resolvePayer", () => {
  const saved = "+254712345678";

  it("defaults to the saved number, normalised, and is not an alternate", () => {
    expect(resolvePayer({ mode: "saved", savedPhone: saved, otherInput: "" })).toEqual({
      phone: "254712345678",
      display: "0712 345 678",
      isAlternate: false,
      error: null
    });
  });

  it.each(["0712345678", "0712 345 678", "0712-345-678", "+254712345678", "254712345678", "+254 712 345 678"])(
    "normalises a different number typed as %j",
    (input) => {
      const result = resolvePayer({ mode: "other", savedPhone: saved, otherInput: input });
      expect(result.phone).toBe("254712345678");
      expect(result.error).toBeNull();
    }
  );

  it("normalises 01 numbers too", () => {
    expect(resolvePayer({ mode: "other", savedPhone: saved, otherInput: "0112345678" }).phone).toBe("254112345678");
  });

  it("marks a genuinely different number as an alternate", () => {
    const result = resolvePayer({ mode: "other", savedPhone: saved, otherInput: "0722 000 111" });
    expect(result).toMatchObject({ phone: "254722000111", display: "0722 000 111", isAlternate: true });
  });

  it("does not call the saved number an alternate when it is typed again", () => {
    expect(resolvePayer({ mode: "other", savedPhone: saved, otherInput: "0712345678" }).isAlternate).toBe(false);
  });

  it.each(["", "   "])("asks for a number when the different-number field is %j", (input) => {
    const result = resolvePayer({ mode: "other", savedPhone: saved, otherInput: input });
    expect(result.phone).toBeNull();
    expect(result.error).toMatch(/required/i);
  });

  it.each(["0612345678", "071234567", "07123456789", "abc", "+255712345678", "0712 345 67x"])(
    "rejects %j as not a Safaricom number",
    (input) => {
      const result = resolvePayer({ mode: "other", savedPhone: saved, otherInput: input });
      expect(result.phone).toBeNull();
      expect(result.error).toMatch(/valid Safaricom number/i);
    }
  );

  it("cannot pay with the saved number when there is none, or it is unusable", () => {
    for (const savedPhone of [null, undefined, "", "+447700900123", "not a number"]) {
      const result = resolvePayer({ mode: "saved", savedPhone, otherInput: "" });
      expect(result.phone).toBeNull();
      expect(result.error).toMatch(/no valid Safaricom number saved/i);
    }
  });

  it("treats every number as an alternate when nothing usable is saved", () => {
    expect(resolvePayer({ mode: "other", savedPhone: null, otherInput: "0712345678" }).isAlternate).toBe(true);
  });
});

describe("hasUsableSavedNumber", () => {
  it("accepts saved Safaricom numbers in any common shape", () => {
    expect(hasUsableSavedNumber("+254712345678")).toBe(true);
    expect(hasUsableSavedNumber("0712345678")).toBe(true);
    expect(hasUsableSavedNumber("+447700900123")).toBe(false);
    expect(hasUsableSavedNumber(undefined)).toBe(false);
  });
});
