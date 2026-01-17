import { z } from "zod";

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
    password: z.string().min(10, "Password must be at least 10 characters"),
    confirmPassword: z.string().min(10, "Confirm your password")
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Provide an email or phone number"
      });
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match"
      });
    }
  });

export const passwordResetSchema = z.object({
  email: z.string().email("Provide a valid email")
});

export const passwordResetPerformSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z.string().min(10, "Password must be at least 10 characters"),
    confirmPassword: z.string().min(10, "Confirm your password")
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
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
