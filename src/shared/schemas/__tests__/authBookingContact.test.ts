/**
 * Making an account in the middle of a booking needs a phone number. The country for a remote consultation is read from the
 * number on the account, so an account with only an email can sign in but the booking is then refused ("not yet available in
 * your country") for a person who is in Kenya. The sign-up page keeps accepting either.
 */

import { describe, expect, it } from "vitest";

import { bookingRegisterSchema, registerSchema } from "../auth";

const base = {
  fullName: "Jane Client",
  email: "",
  phone: "",
  password: "@Qwerty123",
  acceptedTerms: true,
  acknowledgedPrivacy: true
};

const issuesFor = (schema: typeof registerSchema, input: Partial<typeof base>) => {
  const result = schema.safeParse({ ...base, ...input });
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

const PHONE_REQUIRED = "phone: Enter your phone number. We need it to book your consultation.";

describe("sign-up inside a booking", () => {
  it("accepts a phone number alone, or with an email", () => {
    expect(issuesFor(bookingRegisterSchema, { phone: "0712345678" })).toEqual([]);
    expect(issuesFor(bookingRegisterSchema, { phone: "+254 712 345 678", email: "jane@example.com" })).toEqual([]);
  });

  it("does not accept an email alone, and says why", () => {
    expect(issuesFor(bookingRegisterSchema, { email: "jane@example.com" })).toEqual([PHONE_REQUIRED]);
  });

  it("asks for the phone number, not for a phone number or an email, when nothing is given", () => {
    expect(issuesFor(bookingRegisterSchema, {})).toEqual([PHONE_REQUIRED]);
  });

  it("still asks for the two agreements and still rejects a phone that is not one", () => {
    expect(issuesFor(bookingRegisterSchema, { phone: "0712345678", acceptedTerms: false, acknowledgedPrivacy: false })).toEqual([
      "acceptedTerms: You must agree to the Terms of Service",
      "acknowledgedPrivacy: You must acknowledge the Privacy Policy"
    ]);
    expect(issuesFor(bookingRegisterSchema, { phone: "call me" })).toContain("phone: Provide a valid phone");
  });
});

describe("the sign-up page", () => {
  it("still accepts an email alone", () => {
    expect(issuesFor(registerSchema, { email: "jane@example.com" })).toEqual([]);
  });

  it("still asks for a phone number or an email when neither is given", () => {
    expect(issuesFor(registerSchema, {})).toEqual(["phone: Enter a phone number or an email address"]);
  });
});
