import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import { AuthLayout } from "../shared/components/AuthLayout";
import { FormField } from "../shared/components/FormField";
import { Input } from "../shared/components/Input";
import { PasswordField } from "../shared/components/PasswordField";
import { PasswordRequirements } from "../shared/components/PasswordRequirements";
import { Button } from "../shared/components/Button";
import type { RegisterSchema } from "../shared/schemas/auth";
import { registerSchema } from "../shared/schemas/auth";
import { describePasswordSubmitError } from "../shared/utils/passwordErrors";
import { withPasswordConfirmation } from "../shared/utils/passwordResolver";

const REQUIREMENTS_ID = "signup-password-requirements";
import api from "../shared/libs/api";
import { useAuth } from "../shared/hooks/useAuth";
import { returnPathFrom, withReturnPath } from "../shared/utils/returnPath";
import { toInternationalPhone } from "../shared/utils/phoneInput";
import { PHONE_PLACEHOLDER } from "../shared/constants/contact";
import { CURRENT_LEGAL_DOCUMENTS, currentLegalDocumentPayload } from "../shared/constants/legal";

const defaultValues: RegisterSchema = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
  acknowledgedPrivacy: false
};

export const SignUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // Where the person was heading when they were asked to create an account (for example straight into booking).
  const returnTo = useMemo(() => returnPathFrom(location), [location]);
  const { loginClientProvider } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    setError: setFieldError,
    setFocus,
    formState: { isSubmitting }
  } = useForm<RegisterSchema>({
    resolver: withPasswordConfirmation(zodResolver(registerSchema)),
    // Validate as the person types so every password rule reports live, not only on submit.
    mode: "onChange",
    defaultValues
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  // Editing the password can make an already-typed confirmation match (or stop matching).
  useEffect(() => {
    if (confirmPassword) {
      void trigger("confirmPassword");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const phone = toInternationalPhone(values.phone);
      const email = values.email?.trim() || "";
      await api.post("/auth/register", {
        full_name: values.fullName.trim(),
        email: email || undefined,
        phone: phone || undefined,
        password: values.password,
        legal_documents: currentLegalDocumentPayload()
      });

      // Signed in at once: the person came here to book, not to fill in a second form. They go where they were
      // heading, or to Home when they were not heading anywhere in particular.
      try {
        const result = await loginClientProvider({ emailOrPhone: phone || email, password: values.password, remember: true });
        if (result.status !== "mfa_required") {
          navigate(returnTo ?? "/app/home", { replace: true });
          return;
        }
      } catch {
        // The account exists; only the automatic sign-in failed. The sign-in page below finishes the job.
      }
      navigate(withReturnPath("/login", returnTo), { replace: true });
    } catch (err) {
      const failure = describePasswordSubmitError(err, t("auth.signUpError"));
      if (failure.field === "password") {
        // The server rejected the password itself: say so on the field and put focus there.
        setFieldError("password", { type: "server", message: failure.message });
        setFocus("password");
        return;
      }
      setError(failure.message);
    }
  });

  return (
    <AuthLayout
      split
      title={t("auth.signUpTitle")}
      subtitle="Join our community for a premium care experience."
      footer={
        <p className="type-caption text-slate-500">
          {t("auth.haveAccount")}{" "}
          <Link to={withReturnPath("/login", returnTo)} className="font-semibold text-tiba-blue hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormField
          control={control}
          name="fullName"
          render={({ field, fieldState }) => (
            <Input {...field} label={t("auth.fullName")} autoComplete="name" error={fieldState.error?.message} />
          )}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <FormField
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                type="email"
                label={t("auth.email")}
                placeholder="jane@example.com"
                autoComplete="email"
                error={fieldState.error?.message}
              />
            )}
          />

          <FormField
            control={control}
            name="phone"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label={t("auth.phone")}
                placeholder={PHONE_PLACEHOLDER}
                autoComplete="tel"
                error={fieldState.error?.message}
              />
            )}
          />
        </div>

        <FormField
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label={t("auth.password")}
              autoComplete="new-password"
              aria-describedby={REQUIREMENTS_ID}
              error={fieldState.error?.message}
            />
          )}
        />

        <PasswordRequirements
          id={REQUIREMENTS_ID}
          password={password ?? ""}
          confirmPassword={confirmPassword ?? ""}
        />

        <FormField
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label={t("auth.confirmPassword")}
              autoComplete="new-password"
              aria-describedby={REQUIREMENTS_ID}
              error={fieldState.error?.message}
            />
          )}
        />

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {CURRENT_LEGAL_DOCUMENTS.map((document) => {
            const fieldName = document.type === "terms" ? "acceptedTerms" : "acknowledgedPrivacy";
            return (
              <FormField
                key={document.type}
                control={control}
                name={fieldName}
                render={({ field, fieldState }) => (
                  <div>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.target.checked)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {document.actionLabel}{" "}
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-tiba-blue hover:underline"
                        >
                          View {document.title} {document.version}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </span>
                    </label>
                    {fieldState.error?.message && (
                      <p className="mt-1 text-xs font-medium text-red-600">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
            <p className="type-caption text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full h-11" loading={isSubmitting}>
          {t("auth.signUpCta")}
        </Button>

      </form>
    </AuthLayout>
  );
};

export default SignUp;
