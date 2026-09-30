import { describe, expect, it } from "vitest";

import { newPasswordSchema, passwordResetPerformSchema, registerSchema } from "../auth";

const messagesFor = (result: { success: boolean; error?: { issues: { message: string; path: (string | number)[] }[] } }, field: string) =>
  (result.error?.issues ?? []).filter((issue) => issue.path[0] === field).map((issue) => issue.message);

describe("newPasswordSchema", () => {
  it("accepts a password that meets every rule", () => {
    expect(newPasswordSchema.safeParse("@Qwerty123").success).toBe(true);
  });

  it.each([
    ["", "Enter a password"],
    ["Ab1!", "Password must be at least 10 characters"],
    ["abcdefg1!x", "Password needs an uppercase letter"],
    ["ABCDEFG1!X", "Password needs a lowercase letter"],
    ["Abcdefgh!x", "Password needs a number"],
    ["Abcdefgh1x", "Password needs a special character"]
  ])("rejects %j with the message %j", (value, message) => {
    const result = newPasswordSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([message]);
  });
});

describe("passwordResetPerformSchema", () => {
  const valid = { token: "t", password: "@Qwerty123", confirmPassword: "@Qwerty123" };

  it("accepts matching, valid passwords", () => {
    expect(passwordResetPerformSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a token", () => {
    expect(messagesFor(passwordResetPerformSchema.safeParse({ ...valid, token: "" }), "token")).toEqual([
      "Reset token is required"
    ]);
  });

  it("rejects a weak password on the password field", () => {
    const result = passwordResetPerformSchema.safeParse({ ...valid, password: "weak", confirmPassword: "weak" });
    expect(messagesFor(result, "password")).toEqual(["Password must be at least 10 characters"]);
  });

  it("rejects a confirmation that differs", () => {
    const result = passwordResetPerformSchema.safeParse({ ...valid, confirmPassword: "@Qwerty1234" });
    expect(messagesFor(result, "confirmPassword")).toEqual(["Passwords must match"]);
  });

  it("asks for the confirmation when it is empty", () => {
    const result = passwordResetPerformSchema.safeParse({ ...valid, confirmPassword: "" });
    expect(messagesFor(result, "confirmPassword")).toEqual(["Confirm your password"]);
  });
});

describe("registerSchema password rules", () => {
  const valid = {
    fullName: "Jane",
    email: "jane@example.com",
    phone: "",
    password: "@Qwerty123",
    confirmPassword: "@Qwerty123",
    acceptedTerms: true,
    acknowledgedPrivacy: true
  };

  it("applies the same policy as the reset page", () => {
    expect(messagesFor(registerSchema.safeParse({ ...valid, password: "abcdefg1!x", confirmPassword: "abcdefg1!x" }), "password")).toEqual([
      "Password needs an uppercase letter"
    ]);
  });

  it("checks the confirmation once the password itself is valid", () => {
    expect(messagesFor(registerSchema.safeParse({ ...valid, confirmPassword: "@Qwerty12" }), "confirmPassword")).toEqual([
      "Passwords must match"
    ]);
  });
});
