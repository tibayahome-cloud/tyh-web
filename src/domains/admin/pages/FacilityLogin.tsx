import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { AuthLayout } from "../../../shared/components/AuthLayout";
import { AuthPortalSwitch } from "../../../shared/components/AuthPortalSwitch";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { PasswordField } from "../../../shared/components/PasswordField";
import { Loading } from "../../../shared/components/Loading";
import type { AdminLoginSchema } from "../../../shared/schemas/auth";
import { adminLoginSchema } from "../../../shared/schemas/auth";
import { useAuth } from "../../../shared/hooks/useAuth";
import { isSystemAdminRole } from "../../../shared/rbac/portalRoles";
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

// Deliberately identical to the wrong-password message: this page must not confirm that an
// account exists elsewhere, or name any other kind of administrator.
const GENERIC_SIGN_IN_ERROR = "We could not sign you in. Check your details and try again.";

const FacilityLoginPage = () => {
  const { loginAdmin, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedFromPersonal = (location.state as { redirected?: string } | null)?.redirected === "facility-role";
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

      // System administrators have their own sign-in. If one authenticates here, end the session
      // and answer exactly as for a failed sign-in rather than telling them where to go.
      if (isSystemAdminRole(result.user?.roles?.[0])) {
        try {
          await logout();
        } catch {
          // ignore logout failure
        }
        setError(GENERIC_SIGN_IN_ERROR);
        return;
      }

      setRedirecting(true);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : GENERIC_SIGN_IN_ERROR);
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiba-blue/10 px-3 py-1 text-xs font-semibold text-tiba-blue">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Facility portal
        </span>
      }
      title="Facility admin sign in"
      subtitle={
        redirectedFromPersonal
          ? "This account is a facility admin account. Please sign in here."
          : "Manage your facility's services, providers, bookings and payouts."
      }
    >
      <AuthPortalSwitch active="facility" />
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
          <div className="rounded-xl border border-red-100 bg-red-50 p-3" role="alert">
            <p className="type-caption text-center text-red-600">{error}</p>
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

export default FacilityLoginPage;
