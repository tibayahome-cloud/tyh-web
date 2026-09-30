import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";

export const PASSWORDS_MUST_MATCH = "Passwords must match";

// Zod skips an object-level check while any field is still invalid, so on a form with several
// fields a mismatched confirmation would stay hidden until everything else was fixed. This wraps a
// resolver so the mismatch is always reported the moment both passwords have been typed.
export const withPasswordConfirmation =
  <T extends FieldValues>(resolver: Resolver<T>): Resolver<T> =>
  async (values, context, options) => {
    const result = await resolver(values, context, options);
    const { password, confirmPassword } = values as { password?: string; confirmPassword?: string };

    if (!confirmPassword || password === confirmPassword) {
      return result;
    }
    const errors = { ...(result.errors ?? {}) } as Record<string, unknown>;
    if (!errors.confirmPassword) {
      errors.confirmPassword = { type: "validate", message: PASSWORDS_MUST_MATCH };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
