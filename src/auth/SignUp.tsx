import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import { AuthLayout } from "../shared/components/AuthLayout";
import { FormField } from "../shared/components/FormField";
import { Input } from "../shared/components/Input";
import { PasswordField } from "../shared/components/PasswordField";
import { PasswordHint } from "../shared/components/PasswordHint";
import { Button } from "../shared/components/Button";
import type { RegisterSchema } from "../shared/schemas/auth";
import { registerSchema } from "../shared/schemas/auth";
import { describePasswordSubmitError } from "../shared/utils/passwordErrors";

const PASSWORD_HINT_ID = "signup-password-hint";
import api from "../shared/libs/api";
import { useAuth } from "../shared/hooks/useAuth";
import { returnPathFrom, withReturnPath } from "../shared/utils/returnPath";
import { toInternationalPhone } from "../shared/utils/phoneInput";
import { CURRENT_LEGAL_DOCUMENTS, currentLegalDocumentPayload } from "../shared/constants/legal";

const defaultValues: RegisterSchema = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
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
  const [showEmail, setShowEmail] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setError: setFieldError,
    setFocus,
    formState: { isSubmitting, isSubmitted }
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    // Validate as the person types, so the Create account button and the hint under the password stay truthful.
    mode: "onChange",
    defaultValues
  });

  const password = watch("password");

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
      subtitle="Book a doctor online or care at home."
      footer={
        <p className="text-sm text-slate-600">
          {t("auth.haveAccount")}{" "}
          <Link
            to={withReturnPath("/login", returnTo)}
            className="inline-flex min-h-11 items-center rounded px-1 font-semibold text-tiba-blue underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
          >
            Sign in
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

        <FormField
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              type="tel"
              inputMode="tel"
              label="Phone number"
              placeholder="0712 345 678"
              autoComplete="tel"
              hint="We use it to reach you about your appointments."
              error={fieldState.error?.message}
            />
          )}
        />

        <div>
          <FormField
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <PasswordField
                {...field}
                label={t("auth.password")}
                autoComplete="new-password"
                aria-describedby={PASSWORD_HINT_ID}
                // The hint below says what is missing, while typing and after a refused submit (it turns red), so the
                // same sentence is not shown twice. This line is for a refusal from the server.
                error={fieldState.error?.type === "server" ? fieldState.error.message : undefined}
              />
            )}
          />
          <div className="mt-1.5">
            <PasswordHint id={PASSWORD_HINT_ID} password={password ?? ""} invalid={isSubmitted} />
          </div>
        </div>

        {showEmail ? (
          <FormField
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                type="email"
                inputMode="email"
                label="Email (optional)"
                placeholder="jane@example.com"
                autoComplete="email"
                hint="For receipts and appointment emails."
                error={fieldState.error?.message}
              />
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            aria-expanded="false"
            className="-my-1 inline-flex min-h-11 items-center rounded px-1 text-sm font-semibold text-tiba-blue underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
          >
            Add an email for receipts (optional)
          </button>
        )}

        <div className="space-y-1 pt-1">
          {CURRENT_LEGAL_DOCUMENTS.map((document) => {
            const fieldName = document.type === "terms" ? "acceptedTerms" : "acknowledgedPrivacy";
            return (
              <FormField
                key={document.type}
                control={control}
                name={fieldName}
                render={({ field, fieldState }) => (
                  <div>
                    <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.target.checked)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                      <span>
                        {document.actionLabel}{" "}
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Read the ${document.title} ${document.version} (opens in a new tab)`}
                          className="inline-flex items-center gap-1 font-medium text-tiba-blue underline-offset-2 hover:underline"
                        >
                          Read
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </span>
                    </label>
                    {fieldState.error?.message && (
                      <p className="ml-8 text-xs font-medium text-red-600">{fieldState.error.message}</p>
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
