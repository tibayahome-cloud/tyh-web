import { useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";

import { AuthLayout } from "../shared/components/AuthLayout";
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
    <AuthLayout
      title={t("auth.resetPasswordTitle")}
      subtitle={t("auth.resetPasswordDescription")}
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
          <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
            <p className="type-caption text-green-700" role="status">
              {t("auth.resetPasswordSuccess")}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
            <p className="type-caption text-red-600" role="alert">
              {error}
            </p>
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
