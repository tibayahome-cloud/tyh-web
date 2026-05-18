import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AxiosError } from "axios";

import { AuthLayout } from "../shared/components/AuthLayout";
import { FormField } from "../shared/components/FormField";
import { Input } from "../shared/components/Input";
import { Button } from "../shared/components/Button";
import type { PasswordResetSchema } from "../shared/schemas/auth";
import { passwordResetSchema } from "../shared/schemas/auth";
import api from "../shared/libs/api";

const defaultValues: PasswordResetSchema = {
  email: ""
};

export const ForgotPassword = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<PasswordResetSchema>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues
  });

  const submit = handleSubmit(async (values) => {
    setStatus("idle");
    setError(null);
    try {
      await api.post("/auth/password-reset/init", {
        email: values.email
      });
      setStatus("success");
      reset({ ...defaultValues });
    } catch (err) {
      setStatus("error");
      if (err instanceof AxiosError) {
        const message = (err.response?.data as { message?: string })?.message;
        setError(message ?? t("auth.passwordResetError"));
      } else {
        setError(t("auth.passwordResetError"));
      }
    }
  });

  return (
    <AuthLayout
      title={t("auth.passwordResetTitle")}
      subtitle={t("auth.passwordResetDescription")}
      footer={
        <Link to="/login" className="type-caption font-semibold text-tiba-blue hover:underline">
          {t("auth.backToLogin")}
        </Link>
      }
    >
      <form className="space-y-6" onSubmit={submit} noValidate>
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

        {status === "success" && (
          <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
            <p className="type-caption text-green-700" role="status">
              {t("auth.passwordResetSuccess")}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
            <p className="type-caption text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full h-11" loading={isSubmitting}>
          {t("auth.passwordResetCta")}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
