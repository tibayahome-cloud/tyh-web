import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { AuthLayout } from "../../../shared/components/AuthLayout";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { PasswordField } from "../../../shared/components/PasswordField";
import { Loading } from "../../../shared/components/Loading";
import type { AdminLoginSchema } from "../../../shared/schemas/auth";
import { adminLoginSchema } from "../../../shared/schemas/auth";
import { useAuth } from "../../../shared/hooks/useAuth";
import { adminPortalHome } from "../../../shared/rbac/portalRoles";
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

  const handlePostAuth = useCallback(
    (roles: readonly string[] | undefined) => {
      setRedirecting(true);
      navigate(adminPortalHome(roles), { replace: true });
    },
    [navigate]
  );

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
      handlePostAuth(result.user?.roles);
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

  const disableSubmit = isSubmitting || redirecting;

  return (
    <AuthLayout
      compact
      eyebrow={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Restricted access
        </span>
      }
      title="System administration"
      subtitle={redirectedFromApp ? t("auth.adminRedirectNotice") : "Authorised platform administrators only."}
      footer={
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center rounded px-2 text-xs text-slate-500 underline-offset-4 hover:text-tiba-blue hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
        >
          {t("auth.switchUser")}
        </Link>
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
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
                checked={field.value ?? false}
                onChange={(event) => field.onChange(event.target.checked)}
              />
              {t("auth.rememberMe")}
            </label>
          )}
        />

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center" role="alert">
            <p className="type-caption text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" size="lg" fullWidth className="min-h-12" loading={isSubmitting} disabled={disableSubmit}>
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
