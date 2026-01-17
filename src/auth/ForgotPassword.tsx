import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AxiosError } from "axios";

import { Card } from "../shared/components/Card";
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
    <div className="w-full">
      <Card className="mx-auto w-full max-w-lg" title={t("auth.passwordResetTitle")}>
        <p className="mb-6 text-sm text-slate-600">{t("auth.passwordResetDescription")}</p>

        <form className="space-y-4" onSubmit={submit} noValidate>
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
            <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-700" role="status">
              {t("auth.passwordResetSuccess")}
            </p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t("auth.passwordResetCta")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default ForgotPassword;
