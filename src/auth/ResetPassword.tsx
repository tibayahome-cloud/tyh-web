import { useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";

import { Card } from "../shared/components/Card";
import { FormField } from "../shared/components/FormField";
import { PasswordField } from "../shared/components/PasswordField";
import { Button } from "../shared/components/Button";
import api from "../shared/libs/api";
import type { PasswordResetPerformSchema } from "../shared/schemas/auth";
import { passwordResetPerformSchema } from "../shared/schemas/auth";

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
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<PasswordResetPerformSchema>({
    resolver: zodResolver(passwordResetPerformSchema),
    defaultValues: createDefaults(initialToken)
  });

  const submit = handleSubmit(async (values) => {
    setStatus("idle");
    setError(null);

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
      if (err instanceof AxiosError) {
        const message = (err.response?.data as { message?: string })?.message;
        setError(message ?? t("auth.resetPasswordError"));
      } else {
        setError(t("auth.resetPasswordError"));
      }
    }
  });

  const missingToken = !initialToken;

  return (
    <div className="w-full">
      <Card className="mx-auto w-full max-w-lg" title={t("auth.resetPasswordTitle")}>
        <p className="mb-6 text-sm text-slate-600">{t("auth.resetPasswordDescription")}</p>

        {missingToken && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{t("auth.resetPasswordMissingToken")}</p>
        )}

        <form className="space-y-4" onSubmit={submit} noValidate>
          <FormField
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <PasswordField
                {...field}
                label={t("auth.password")}
                autoComplete="new-password"
                error={fieldState.error?.message}
              />
            )}
          />

          <FormField
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <PasswordField
                {...field}
                label={t("auth.confirmPassword")}
                autoComplete="new-password"
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
            <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-700" role="status">
              {t("auth.resetPasswordSuccess")}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={isSubmitting} disabled={missingToken}>
            {t("auth.resetPasswordCta")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
            {t("auth.backToLogin")}
          </Link>
        </p>

        {missingToken && (
          <p className="mt-3 text-center text-xs text-slate-500">
            {t("auth.resetPasswordMissingTokenHelp")}
            <Link to="/forgot-password" className="font-semibold text-primary-600 hover:text-primary-700">
              {t("auth.forgotPassword")}
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
