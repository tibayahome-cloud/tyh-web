import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AxiosError } from "axios";

import { Card } from "../shared/components/Card";
import { FormField } from "../shared/components/FormField";
import { Input } from "../shared/components/Input";
import { PasswordField } from "../shared/components/PasswordField";
import { Button } from "../shared/components/Button";
import type { RegisterSchema } from "../shared/schemas/auth";
import { registerSchema } from "../shared/schemas/auth";
import api from "../shared/libs/api";

const defaultValues: RegisterSchema = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: ""
};

export const SignUp = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues
  });

  const submit = handleSubmit(async (values) => {
    setStatus("idle");
    setError(null);
    try {
      await api.post("/auth/register", {
        full_name: values.fullName.trim(),
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        password: values.password
      });
      setStatus("success");
      reset({ ...defaultValues });
    } catch (err) {
      setStatus("error");
      if (err instanceof AxiosError) {
        const message = (err.response?.data as { message?: string })?.message;
        setError(message ?? t("auth.signUpError"));
      } else {
        setError(t("auth.signUpError"));
      }
    }
  });

  return (
    <div className="w-full">
      <Card className="mx-auto w-full max-w-lg" title={t("auth.signUpTitle")}>
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
                placeholder="+254700000000"
                autoComplete="tel"
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

          {status === "success" && (
            <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-700" role="status">
              {t("auth.signUpSuccess")}
            </p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t("auth.signUpCta")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default SignUp;
