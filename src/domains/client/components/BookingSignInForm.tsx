import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { PasswordField } from "../../../shared/components/PasswordField";
import { useAuth } from "../../../shared/hooks/useAuth";
import { isFacilityAdminRole, isSystemAdminRole } from "../../../shared/rbac/portalRoles";
import { ROLE_PROVIDER } from "../../../shared/rbac/roles";
import type { LoginSchema } from "../../../shared/schemas/auth";
import { loginSchema } from "../../../shared/schemas/auth";

type BookingSignInFormProps = {
  /** Runs once the person is signed in as a client and the booking can carry on. */
  onSignedIn: () => void;
  /** The number or email to start with, when the person has just typed it on the sign-up form. */
  defaultEmailOrPhone?: string;
};

const defaultValues: LoginSchema = { emailOrPhone: "", password: "", remember: true };

/**
 * Signing in without leaving the booking, for someone who already has an account and reached the details step. It
 * keeps their chosen consultation, clinic and time exactly where they are, which a trip to the sign-in page would not.
 */
export const BookingSignInForm = ({ onSignedIn, defaultEmailOrPhone = "" }: BookingSignInFormProps) => {
  const { t } = useTranslation();
  const { loginClientProvider, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setFocus,
    formState: { isSubmitting }
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { ...defaultValues, emailOrPhone: defaultEmailOrPhone }
  });

  // With the number already in place, the password is the one thing left to type. The button that brought the person here
  // has gone, so focus would otherwise fall to the top of the page.
  useEffect(() => {
    if (defaultEmailOrPhone) {
      setFocus("password");
    }
    // Only when the form first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await loginClientProvider(values);
      if (result.status === "mfa_required") {
        setError("This account asks for a verification code. Sign in from the sign-in page, then come back to book.");
        return;
      }
      const role = result.user?.roles?.[0];
      if (role === ROLE_PROVIDER || isFacilityAdminRole(role) || isSystemAdminRole(role)) {
        // A booking is made by a client. Staff sign in from their own pages.
        try {
          await logout();
        } catch {
          // The message below is what matters; signing out is best effort.
        }
        setError("That is a staff account. Staff sign in from their own sign-in page.");
        return;
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not sign you in. Check your details and try again.");
    }
  });

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <FormField
        control={control}
        name="emailOrPhone"
        render={({ field, fieldState }) => (
          <Input
            {...field}
            label={t("auth.emailOrPhone")}
            placeholder="0712 345 678"
            autoComplete="username"
            error={fieldState.error?.message}
          />
        )}
      />

      <FormField
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            {...field}
            label={t("auth.password")}
            autoComplete="current-password"
            error={fieldState.error?.message}
          />
        )}
      />

      {/* A new tab, so the booking in this one is still here when the password has been reset. */}
      <a
        href="/forgot-password"
        target="_blank"
        rel="noreferrer"
        aria-label={`${t("auth.forgotPassword")} (opens in a new tab)`}
        className="-mt-2 inline-flex min-h-11 items-center gap-1 rounded text-sm font-semibold text-tiba-blue underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
      >
        {t("auth.forgotPassword")}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3" role="alert">
          <p className="type-caption text-center text-red-600">{error}</p>
        </div>
      )}

      <Button type="submit" className="w-full h-11" loading={isSubmitting}>
        Sign in and continue
      </Button>
    </form>
  );
};

export default BookingSignInForm;
