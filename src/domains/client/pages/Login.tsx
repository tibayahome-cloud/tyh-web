import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
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
    <div className="w-full">
      <div className="relative">
        <Card className="mx-auto w-full max-w-lg" title={t("auth.loginTitle")}>
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

          <Button type="submit" className="w-full" loading={isSubmitting} disabled={disableSubmit}>
            {t("auth.submit")}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-slate-500">
          <Link to="/forgot-password" className="font-semibold text-primary-600 hover:text-primary-700">
            {t("auth.forgotPassword")}
          </Link>
          <Link to="/signup" className="font-semibold text-primary-600 hover:text-primary-700">
            {t("auth.signUp")}
          </Link>
        </div>
        </Card>
        {isBusy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
            <Loading label={redirecting ? t("auth.redirecting") : t("auth.signingIn")} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientLoginPage;
