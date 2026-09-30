import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import { AuthLayout } from "../shared/components/AuthLayout";
import { FormField } from "../shared/components/FormField";
import { PasswordField } from "../shared/components/PasswordField";
import { PasswordRequirements } from "../shared/components/PasswordRequirements";
import { Button } from "../shared/components/Button";
import api from "../shared/libs/api";
import type { PasswordResetPerformSchema } from "../shared/schemas/auth";
import { passwordResetPerformSchema } from "../shared/schemas/auth";
import { describePasswordSubmitError } from "../shared/utils/passwordErrors";
import { withPasswordConfirmation } from "../shared/utils/passwordResolver";

const REQUIREMENTS_ID = "reset-password-requirements";

const createDefaults = (token: string | null): PasswordResetPerformSchema => ({
  token: token ?? "",
  password: "",
  confirmPassword: ""
});

export const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialToken = useMemo(() => searchParams.get("token"), [searchParams]);
  const isInvitation = searchParams.get("flow") === "invitation";
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    trigger,
    setError: setFieldError,
    setFocus,
    formState: { isSubmitting, submitCount }
  } = useForm<PasswordResetPerformSchema>({
    resolver: withPasswordConfirmation(zodResolver(passwordResetPerformSchema)),
    // Validate as the person types so every rule reports live, not only on submit.
    mode: "onChange",
    defaultValues: createDefaults(initialToken)
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
    setStatus("idle");
    setError(null);
    setRetryable(false);

    try {
      await api.post("/auth/password-reset/perform", {
        token: values.token,
        new_password: values.password
      });

      setStatus("success");
      reset(createDefaults(initialToken));
      // after a short delay, navigate to login
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    } catch (err) {
      setStatus("error");
      const failure = describePasswordSubmitError(err, t("auth.resetPasswordError"));
      if (failure.field === "password") {
        // The server rejected the password itself: say so on the field and put focus there.
        setFieldError("password", { type: "server", message: failure.message });
        setFocus("password");
        return;
      }
      setError(failure.message);
      setRetryable(failure.retryable);
    }
  });

  const missingToken = !initialToken;

  return (
    <AuthLayout
      title={t("auth.resetPasswordTitle")}
      subtitle={isInvitation ? "Create your password to activate your TYH account." : t("auth.resetPasswordDescription")}
      footer={
        <div className="flex flex-col items-center gap-3">
          <Link to="/login" className="type-caption font-semibold text-tiba-blue hover:underline">
            {t("auth.backToLogin")}
          </Link>
          {missingToken && (
            <p className="text-center text-[10px] text-slate-400">
              {t("auth.resetPasswordMissingTokenHelp")}{" "}
              <Link to="/forgot-password" title={t("auth.forgotPassword")} className="font-semibold text-tiba-blue hover:underline">
                {t("auth.forgotPassword")}
              </Link>
            </p>
          )}
        </div>
      }
    >
      {missingToken && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-3 text-center">
          <p className="type-caption text-red-600">{t("auth.resetPasswordMissingToken")}</p>
        </div>
      )}

      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormField
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label={isInvitation ? "Create password" : "New password"}
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
          showFailures={submitCount > 0}
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

        <FormField
          control={control}
          name="token"
          render={({ field, fieldState }) => (
            <input
              {...field}
              type="hidden"
              aria-invalid={Boolean(fieldState.error)}
              aria-describedby={fieldState.error ? "reset-token-error" : undefined}
            />
          )}
        />

        {status === "success" && (
          <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
            <p className="type-caption text-green-700" role="status">
              {isInvitation ? "Password created. You can now sign in." : t("auth.resetPasswordSuccess")}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
            <p className="type-caption text-red-600" role="alert">
              {error}
            </p>
            {retryable && (
              <p className="mt-1 text-center text-xs text-red-600">Your password was not changed. You can submit again.</p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full h-11" loading={isSubmitting} disabled={missingToken}>
          {t("auth.resetPasswordCta")}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
