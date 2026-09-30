import { describe, expect, it } from "vitest";

import { evaluatePassword, firstPasswordProblem, isPasswordValid, PASSWORD_MIN_LENGTH } from "../passwordPolicy";

// The API's rule (app/utils/validation.py PASSWORD_PATTERN), copied here so any drift between it
// and the live checklist shows up as a failing comparison rather than a rejection in production.
const API_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

describe("password policy", () => {
  it("requires ten characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  it.each(["@Qwerty123", "Correct-Horse-9", "aB3$aB3$aB3$", "Pässword1!x", "  Spaces1! a "])(
    "accepts %j",
    (password) => {
      expect(isPasswordValid(password)).toBe(true);
      expect(firstPasswordProblem(password)).toBeNull();
      expect(evaluatePassword(password).every((requirement) => requirement.met)).toBe(true);
    }
  );

  it.each([
    ["too short", "Ab1!abcd", "length", "Password must be at least 10 characters"],
    ["no uppercase", "abcdefg1!x", "uppercase", "Password needs an uppercase letter"],
    ["no lowercase", "ABCDEFG1!X", "lowercase", "Password needs a lowercase letter"],
    ["no number", "Abcdefgh!x", "digit", "Password needs a number"],
    ["no special character", "Abcdefgh1x", "special", "Password needs a special character"]
  ])("rejects a password that is %s and names that rule", (_name, password, id, message) => {
    expect(isPasswordValid(password)).toBe(false);
    expect(firstPasswordProblem(password)).toBe(message);
    const unmet = evaluatePassword(password).filter((requirement) => !requirement.met);
    expect(unmet.map((requirement) => requirement.id)).toEqual([id]);
  });

  it("reports every unmet rule for an empty password, and the length rule first", () => {
    const unmet = evaluatePassword("").filter((requirement) => !requirement.met);
    expect(unmet).toHaveLength(5);
    expect(firstPasswordProblem("")).toBe("Password must be at least 10 characters");
  });

  it("never disagrees with the API's pattern", () => {
    const samples = [
      "", "a", "Aa1!", "Aa1!Aa1!Aa", "Aa1!Aa1!A", "aa1!aa1!aa", "AA1!AA1!AA", "Aa!!Aa!!Aa", "Aa11Aa11Aa",
      "@Qwerty123", "password", "PASSWORD123!", "Passw0rd!!", "Passw0rd  ", "ééééééééééÉ1!", "12345678901!Aa"
    ];
    for (const sample of samples) {
      expect(isPasswordValid(sample), JSON.stringify(sample)).toBe(API_PATTERN.test(sample));
    }
  });
});
