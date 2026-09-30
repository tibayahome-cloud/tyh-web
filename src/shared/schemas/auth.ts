import { z } from "zod";

import { firstPasswordProblem } from "../utils/passwordPolicy";

// One rule set for every place a person chooses a password. The message names the first
// requirement still unmet, so the field error and the live checklist never disagree.
export const newPasswordSchema = z
  .string()
  .min(1, "Enter a password")
  .superRefine((value, ctx) => {
    if (!value) {
      return;
    }
    const problem = firstPasswordProblem(value);
    if (problem) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }
  });

export const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Email or phone is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional()
});

export const adminLoginSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional()
});

const optionalEmail = z
  .string()
  .email("Provide a valid email")
  .optional()
  .transform((value) => value?.trim() ?? "");

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .pipe(
    z
      .string()
      .regex(/^$|^\+?[0-9]{7,15}$/u, "Provide a valid phone")
  );

export const registerSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: optionalEmail,
    phone: optionalPhone,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptedTerms: z.boolean(),
    acknowledgedPrivacy: z.boolean()
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Provide an email or phone number"
      });
    }

    if (data.confirmPassword && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match"
      });
    }

    if (!data.acceptedTerms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptedTerms"],
        message: "You must agree to the Terms of Service"
      });
    }

    if (!data.acknowledgedPrivacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acknowledgedPrivacy"],
        message: "You must acknowledge the Privacy Policy"
      });
    }
  });

export const passwordResetSchema = z.object({
  email: z.string().email("Provide a valid email")
});

export const passwordResetPerformSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your password")
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match"
      });
    }
  });

export type LoginSchema = z.infer<typeof loginSchema>;
export type AdminLoginSchema = z.infer<typeof adminLoginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type PasswordResetSchema = z.infer<typeof passwordResetSchema>;
export type PasswordResetPerformSchema = z.infer<typeof passwordResetPerformSchema>;
