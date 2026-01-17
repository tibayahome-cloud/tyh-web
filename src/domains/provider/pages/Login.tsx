import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../shared/components/Button";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { PasswordField } from "../../../shared/components/PasswordField";
import type { LoginSchema } from "../../../shared/schemas/auth";
import { loginSchema } from "../../../shared/schemas/auth";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
  saveTwofaChallenge,
  setTwofaPendingFlag,
  isTwofaPending,
  clearTwofaChallenge
} from "../../../shared/utils/twofaStorage";

type ProviderLoginFormProps = {
  onSuccess?: () => void;
};

const defaultValues: LoginSchema = {
  emailOrPhone: "",
  password: "",
  remember: true
};

const ProviderLoginForm = ({ onSuccess }: ProviderLoginFormProps) => {
  const { loginClientProvider } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    clearTwofaChallenge();
    setTwofaPendingFlag(false);

    try {
      const result = await loginClientProvider(values);
      if (result.status === "mfa_required") {
        saveTwofaChallenge({
          method: result.method,
          sessionHint: result.sessionHint,
          userId: result.userId,
          origin: "provider",
          methods: result.availableMethods
        });
        setTwofaPendingFlag(true);
        navigate("/two-factor", { replace: true });
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We could not sign you in. Check your details and try again."
      );
    }
  });

  useEffect(() => {
    if (isTwofaPending()) {
      navigate("/two-factor", { replace: true });
    } else {
      clearTwofaChallenge();
      setTwofaPendingFlag(false);
    }
  }, [navigate]);

  return (
    <>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormField
          control={control}
          name="emailOrPhone"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              label={t("auth.emailOrPhone")}
              placeholder="jane@example.com"
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

        <FormField
          control={control}
          name="remember"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={field.value ?? false}
                onChange={(event) => field.onChange(event.target.checked)}
              />
              {t("auth.rememberMe")}
            </label>
          )}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
          {t("auth.submit")}
        </Button>
      </form>
    </>
  );
};

export default ProviderLoginForm;
