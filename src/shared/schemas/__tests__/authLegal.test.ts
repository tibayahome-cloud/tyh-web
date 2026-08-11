import { describe, expect, it } from "vitest";

import { registerSchema } from "../auth";

const validRegistration = {
  fullName: "Jane Client",
  email: "jane@example.com",
  phone: "",
  password: "@Qwerty123",
  confirmPassword: "@Qwerty123",
  acceptedTerms: true,
  acknowledgedPrivacy: true
};

describe("registration legal consent schema", () => {
  it("requires Terms agreement and Privacy acknowledgement", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      acceptedTerms: false,
      acknowledgedPrivacy: false
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join("."));
      expect(fields).toContain("acceptedTerms");
      expect(fields).toContain("acknowledgedPrivacy");
    }
  });

  it("accepts a registration with both legal controls selected", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
  });
});
