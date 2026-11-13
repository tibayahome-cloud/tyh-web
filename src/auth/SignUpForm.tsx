import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

import { FormField } from "../shared/components/FormField";
import { Input } from "../shared/components/Input";
import { PasswordField } from "../shared/components/PasswordField";
import { PasswordHint } from "../shared/components/PasswordHint";
import { Button } from "../shared/components/Button";
import type { RegisterSchema } from "../shared/schemas/auth";
import { bookingRegisterSchema, registerSchema } from "../shared/schemas/auth";
import { describePasswordSubmitError } from "../shared/utils/passwordErrors";
import api from "../shared/libs/api";
import { useAuth } from "../shared/hooks/useAuth";
import { toInternationalPhone } from "../shared/utils/phoneInput";
import { CURRENT_LEGAL_DOCUMENTS, currentLegalDocumentPayload } from "../shared/constants/legal";

const PASSWORD_HINT_ID = "signup-password-hint";

const defaultValues: RegisterSchema = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  acceptedTerms: false,
  acknowledgedPrivacy: false
};

export type SignUpFormProps = {
  /** What the submit button says. Defaults to the sign-up page's own wording. */
  submitLabel?: string;
  /** Ask for a phone number rather than "a phone number or an email". The booking needs one; the sign-up page does not. */
  requirePhone?: boolean;
  /** Runs once the account exists and the person is signed in. `phone` is the number in international form. */
  onSignedUp: (account: { phone: string; email: string }) => void;
  /** Runs when the account was made but signing in did not work, so the person can finish on a sign-in screen. */
  onSignInNeeded: () => void;
  /**
   * Runs when the server refuses because that phone number or email already has an account. `identifier` is what the person
   * typed. When this is given the form hands over instead of showing the refusal, so the caller can take them to signing
   * in. Left out, the refusal is shown on the form as before.
   */
  onAccountExists?: (identifier: string) => void;
};

// The API's own wording for a number or email that is taken ("Phone already in use", "Email already in use"). It sends no
// error code for this, so the message is what there is to go on; a message that does not match is simply shown as before.
const ACCOUNT_EXISTS_MESSAGE = /\b(phone|email)\b.*\balready\b.*\b(in use|registered|exists?)\b/i;

/**
 * The sign-up fields and what happens on submit, shared by the sign-up page and the booking's details step: register,
 * then sign the person in at once. The caller decides where they go next.
 */
export const SignUpForm = ({ submitLabel, requirePhone = false, onSignedUp, onSignInNeeded, onAccountExists }: SignUpFormProps) => {
  const { t } = useTranslation();
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
    resolver: zodResolver(requirePhone ? bookingRegisterSchema : registerSchema),
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

      // Signed in at once: the person came here to book, not to fill in a second form.
      try {
        const result = await loginClientProvider({ emailOrPhone: phone || email, password: values.password, remember: true });
        if (result.status !== "mfa_required") {
          onSignedUp({ phone, email });
          return;
        }
      } catch {
        // The account exists; only the automatic sign-in failed. A sign-in screen finishes the job.
      }
      onSignInNeeded();
    } catch (err) {
      const failure = describePasswordSubmitError(err, t("auth.signUpError"));
      if (onAccountExists && ACCOUNT_EXISTS_MESSAGE.test(failure.message)) {
        // Hand over the one the server named: someone who typed both may have a new number and an email that is taken.
        const emailTaken = /\bemail\b/i.test(failure.message);
        onAccountExists((emailTaken ? values.email?.trim() : values.phone.trim()) || values.phone.trim());
        return;
      }
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
        {submitLabel ?? t("auth.signUpCta")}
      </Button>
    </form>
  );
};

export default SignUpForm;
