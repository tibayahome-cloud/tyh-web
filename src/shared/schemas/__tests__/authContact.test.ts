/**
 * Sign-up asks for an email or a phone number, not both. The API accepts either, and many clients have no email
 * address at all; the form used to reject an empty email as "not a valid email", so a phone-only sign-up could never
 * be submitted.
 */

import { describe, expect, it } from "vitest";

import { registerSchema } from "../auth";

const PASSWORD = "@Qwerty123";

const base = {
  fullName: "Jane Client",
  email: "",
  phone: "",
  password: PASSWORD,
  acceptedTerms: true,
  acknowledgedPrivacy: true
};

const issues = (input: Partial<typeof base>) => {
  const result = registerSchema.safeParse({ ...base, ...input });
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("sign-up contact details", () => {
  it("accepts a phone number alone", () => {
    expect(issues({ phone: "0712345678" })).toEqual([]);
  });

  it("accepts an email alone", () => {
    expect(issues({ email: "jane@example.com" })).toEqual([]);
  });

  it("accepts both", () => {
    expect(issues({ email: "jane@example.com", phone: "+254712345678" })).toEqual([]);
  });

  it("asks for one of them when neither is given", () => {
    expect(issues({})).toContain("phone: Enter a phone number or an email address");
  });

  it("still rejects an email that is not one", () => {
    expect(issues({ email: "not-an-email", phone: "0712345678" })).toContain("email: Provide a valid email");
  });

  it("reads a phone number written with spaces, hyphens or brackets", () => {
    for (const phone of ["0712 345 678", "0712-345-678", "(0712) 345 678", "+254 712 345 678"]) {
      expect(issues({ phone }), phone).toEqual([]);
    }
  });

  it("still rejects a phone number that is not one", () => {
    expect(issues({ phone: "call me" })).toContain("phone: Provide a valid phone");
  });
});
