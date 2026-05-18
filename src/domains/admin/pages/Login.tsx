import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import { Button } from "../../../shared/components/Button";
import { AuthLayout } from "../../../shared/components/AuthLayout";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { PasswordField } from "../../../shared/components/PasswordField";
import { Loading } from "../../../shared/components/Loading";
import type { AdminLoginSchema } from "../../../shared/schemas/auth";
import { adminLoginSchema } from "../../../shared/schemas/auth";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
  saveTwofaChallenge,
  setTwofaPendingFlag,
  isTwofaPending,
  clearTwofaChallenge
} from "../../../shared/utils/twofaStorage";

const defaultValues: AdminLoginSchema = {
  email: "",
  password: "",
  remember: true
};

const AdminLoginPage = () => {
  const { loginAdmin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedFromApp = (location.state as { redirected?: string } | null)?.redirected === "admin-role";
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<AdminLoginSchema>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues
  });

  const handlePostAuth = useCallback(() => {
    setRedirecting(true);
    navigate("/admin/dashboard", { replace: true });
  }, [navigate]);

  const submit = handleSubmit(async (values) => {
    setError(null);
    clearTwofaChallenge();
    setTwofaPendingFlag(false);
    setRedirecting(false);

    try {
      const result = await loginAdmin(values);
      if (result.status === "mfa_required") {
        saveTwofaChallenge({
          method: result.method,
          sessionHint: result.sessionHint,
          userId: result.userId,
          origin: "admin",
          methods: result.availableMethods
        });
        setTwofaPendingFlag(true);
        navigate("/two-factor", { replace: true });
        return;
      }
      handlePostAuth();
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

  const isBusy = isSubmitting || redirecting;
  const disableSubmit = isSubmitting || redirecting;

  return (
    <AuthLayout
      title={t("auth.adminLoginTitle")}
      subtitle={redirectedFromApp ? t("auth.adminRedirectNotice") : "Portal access for system administrators."}
      footer={
        <p className="type-caption text-slate-500">
          Not an admin?{" "}
          <button
            type="button"
            className="font-semibold text-tiba-blue hover:underline"
            onClick={() => navigate("/login")}
          >
            {t("auth.switchUser")}
          </button>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormField
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              type="email"
              label={t("auth.email")}
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
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
                checked={field.value ?? false}
                onChange={(event) => field.onChange(event.target.checked)}
              />
              {t("auth.rememberMe")}
            </label>
          )}
        />

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
            <p className="type-caption text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full h-11" loading={isSubmitting} disabled={disableSubmit}>
          {t("auth.submit")}
        </Button>
      </form>

      {(isSubmitting || redirecting) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <Loading label={redirecting ? t("auth.redirecting") : t("auth.signingIn")} />
        </div>
      )}
    </AuthLayout>
  );
};

export default AdminLoginPage;
