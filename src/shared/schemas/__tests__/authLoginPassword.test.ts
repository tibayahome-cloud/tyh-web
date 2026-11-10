/**
 * Signing in must not judge the length of a password: whatever length someone set is what they will type. The shared
 * password rule (six characters or more, with every kind of character) belongs to choosing a password, not to using it.
 * The sign-in forms used to insist on eight, which locked out anyone who had chosen six under the current rule.
 */

import { describe, expect, it } from "vitest";

import { adminLoginSchema, loginSchema } from "../auth";

describe("the password check on the sign-in forms", () => {
  it.each(["Ab1!xy", "a", "Correct-Horse-Battery-9"])("lets a client sign in with %j", (password) => {
    expect(loginSchema.safeParse({ emailOrPhone: "0712345678", password }).success).toBe(true);
  });

  it.each(["Ab1!xy", "a", "Correct-Horse-Battery-9"])("lets an administrator sign in with %j", (password) => {
    expect(adminLoginSchema.safeParse({ email: "admin@example.com", password }).success).toBe(true);
  });

  it("only asks for a password to be entered", () => {
    const client = loginSchema.safeParse({ emailOrPhone: "0712345678", password: "" });
    const admin = adminLoginSchema.safeParse({ email: "admin@example.com", password: "" });

    expect(client.success).toBe(false);
    expect(admin.success).toBe(false);
    expect(client.error?.issues.map((issue) => issue.message)).toEqual(["Enter your password"]);
    expect(admin.error?.issues.map((issue) => issue.message)).toEqual(["Enter your password"]);
  });
});
