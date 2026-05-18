import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import { Button } from "../../../shared/components/Button";
import { AuthLayout } from "../../../shared/components/AuthLayout";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { PasswordField } from "../../../shared/components/PasswordField";
import { Loading } from "../../../shared/components/Loading";
import type { LoginSchema } from "../../../shared/schemas/auth";
import { loginSchema } from "../../../shared/schemas/auth";
import { useAuth } from "../../../shared/hooks/useAuth";
import type { AuthUser } from "../../../shared/schemas/user";
import { ROLE_ADMIN, ROLE_ADMIN_SUPER, ROLE_PROVIDER } from "../../../shared/rbac/roles";
import {
  saveTwofaChallenge,
  setTwofaPendingFlag,
  isTwofaPending,
  clearTwofaChallenge
} from "../../../shared/utils/twofaStorage";

const defaultValues: LoginSchema = {
  emailOrPhone: "",
  password: "",
  remember: true
};

const ClientLoginPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { loginClientProvider, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const handlePostAuth = useCallback(async (authUser: AuthUser | null) => {
    const primaryRole = authUser?.roles?.[0];
    if (primaryRole === ROLE_ADMIN || primaryRole === ROLE_ADMIN_SUPER) {
      setRedirecting(true);
      try {
        await logout();
      } catch {
        // ignore logout failure
      }
      navigate("/admin/login", { replace: true, state: { redirected: "admin-role" } });
      return;
    }

    setRedirecting(true);
    if (primaryRole === ROLE_PROVIDER) {
      navigate("/pro/home", { replace: true });
      return;
    }

    navigate("/app/home", { replace: true });
  }, [logout, navigate]);


  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues
  });

  const submitClient = handleSubmit(async (values) => {
    setError(null);
    clearTwofaChallenge();
    setTwofaPendingFlag(false);
    setRedirecting(false);

    try {
      const result = await loginClientProvider(values);

      if (result.status === "mfa_required") {
        saveTwofaChallenge({
          method: result.method,
          sessionHint: result.sessionHint,
          userId: result.userId,
          origin: "client",
          methods: result.availableMethods
        });
        setTwofaPendingFlag(true);
        navigate("/two-factor", { replace: true });
        return;
      }

      await handlePostAuth(result.user);
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
      title={t("auth.loginTitle")}
      subtitle="Welcome back! Please enter your details to continue."
      footer={
        <p className="type-caption text-slate-500">
          {t("auth.noAccount")}{" "}
          <Link to="/signup" className="font-semibold text-tiba-blue hover:underline">
            {t("auth.signUp")}
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={submitClient} noValidate>
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

        <div className="flex items-center justify-between">
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
          <Link to="/forgot-password" shakes="true" className="type-caption font-medium text-tiba-blue hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="type-caption text-center text-red-600">{error}</p>
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

export default ClientLoginPage;
