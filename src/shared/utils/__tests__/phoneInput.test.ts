import { describe, expect, it } from "vitest";

import { toInternationalPhone } from "../phoneInput";

describe("toInternationalPhone", () => {
  it.each(["+254712345678", "254712345678", "0712345678", "0712 345 678", "0712-345-678", "(0712) 345 678", "+254 712 345 678", " 0712345678 "])(
    "reads %s as +254712345678",
    (typed) => {
      expect(toInternationalPhone(typed)).toBe("+254712345678");
    }
  );

  it("leaves another country's number, and anything it cannot read, as typed (spaces removed)", () => {
    expect(toInternationalPhone("+1 415 555 0123")).toBe("+14155550123");
    expect(toInternationalPhone("12345")).toBe("12345");
    expect(toInternationalPhone("")).toBe("");
    expect(toInternationalPhone(undefined)).toBe("");
  });
});
