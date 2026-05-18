import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";

import { AuthLayout } from "../shared/components/AuthLayout";
import { Button } from "../shared/components/Button";
import { Input } from "../shared/components/Input";
import { useAuth } from "../shared/hooks/useAuth";
import api from "../shared/libs/api";
import { useToast } from "../shared/components/ToastProvider";
import { ROLE_ADMIN, ROLE_ADMIN_SUPER, ROLE_PROVIDER } from "../shared/rbac/roles";
import {
  readTwofaChallenge,
  clearTwofaChallenge,
  setTwofaPendingFlag,
  updateTwofaChallenge
} from "../shared/utils/twofaStorage";

const methodCopy: Record<string, string> = {
  sms: "We sent a code via SMS",
  email: "Check your email for a verification code",
  totp: "Enter the code from your authenticator app"
};

export const TwoFactorPage = () => {
  const navigate = useNavigate();
  const { verifyTwoFactor, logout, roles: authRoles } = useAuth();
  const toast = useToast();
  const [challenge, setChallenge] = useState(() => readTwofaChallenge());
  const [code, setCode] = useState("");
  const [selectedMethod, setSelectedMethod] = useState(() => challenge?.method ?? "sms");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingMethod, setSendingMethod] = useState<string | null>(null);

  useEffect(() => {
    if (!challenge) {
      setTwofaPendingFlag(false);
      return;
    }
    setTwofaPendingFlag(true);
    setSelectedMethod(challenge.method);
  }, [challenge]);

  const instructions = useMemo(() => {
    if (!challenge) {
      return "Two-factor challenge not found. Please sign in again.";
    }
    return methodCopy[selectedMethod] ?? "Enter the verification code";
  }, [challenge, selectedMethod]);

  const resendOptions = useMemo(() => {
    if (!challenge) {
      return [];
    }
    const methods = challenge.methods && challenge.methods.length > 0 ? challenge.methods : [challenge.method];
    return methods.filter((method) => method === "sms" || method === "email");
  }, [challenge]);

  const handleSuccessRedirect = (roles: string[] | undefined) => {
    const effectiveRoles = roles && roles.length ? roles : authRoles;
    if (effectiveRoles?.includes(ROLE_ADMIN) || effectiveRoles?.includes(ROLE_ADMIN_SUPER)) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }
    if (effectiveRoles?.includes(ROLE_PROVIDER)) {
      navigate("/pro/home", { replace: true });
      return;
    }
    navigate("/app/home", { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challenge) {
      navigate("/login", { replace: true });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await verifyTwoFactor({ method: selectedMethod, sessionHint: challenge.sessionHint, code });
      clearTwofaChallenge();
      setTwofaPendingFlag(false);
      handleSuccessRedirect(result.user?.roles);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Invalid verification code");
    }
  };

  const handleResend = async (method: string) => {
    if (!challenge) {
      return;
    }
    setSendingMethod(method);
    try {
      const response = await api.post("/auth/2fa/send", {
        session_hint: challenge.sessionHint,
        method
      });
      const chosenMethod = response.data?.data?.method ?? method;
      setChallenge((current) => {
        if (!current) {
          return current;
        }
        const next = { ...current, method: chosenMethod };
        updateTwofaChallenge({ method: chosenMethod });
        return next;
      });
      setSelectedMethod(chosenMethod);
      toast.showToast({
        title: "Code sent",
        description: method === "sms" ? "Check your phone for a new code." : "Check your email inbox.",
        variant: "success"
      });
    } catch (err) {
      toast.showToast({
        title: "Unable to send code",
        description: err instanceof Error ? err.message : "Please try again shortly.",
        variant: "error"
      });
    } finally {
      setSendingMethod(null);
    }
  };

  const handleBackToLogin = async () => {
    clearTwofaChallenge();
    setTwofaPendingFlag(false);
    try {
      await logout();
    } catch {
      /* ignore */
    }
    navigate("/login", { replace: true });
  };

  if (!challenge) {
    return (
      <AuthLayout title="Two-factor authentication" subtitle="Session expired">
        <p className="type-body text-slate-600">
          We could not find an active verification request. Please sign in again.
        </p>
        <Button className="mt-8 w-full" onClick={() => navigate("/login", { replace: true })}>
          Back to login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify it’s you"
      subtitle={instructions}
      footer={
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            className="type-caption font-semibold text-tiba-blue hover:underline"
            onClick={handleBackToLogin}
          >
            Cancel login
          </button>
          <span className="type-caption text-slate-400 italic">
            Need another method? Contact support.
          </span>
        </div>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="Verification code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoFocus
            autoComplete="one-time-code"
            maxLength={8}
            inputMode="numeric"
            className="text-center font-mono text-xl tracking-widest"
            required
          />
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
              <p className="type-caption text-red-600">{error}</p>
            </div>
          )}
        </div>

        <Button type="submit" className="w-full h-11" loading={submitting} disabled={!code.trim() || submitting}>
          Confirm code
        </Button>
      </form>

      <div className="mt-8 space-y-6">
        {challenge?.methods && challenge.methods.length > 1 && (
          <div className="flex flex-col gap-3">
            <span className="type-caption text-slate-500 text-center">Switch verification method</span>
            <div className="flex flex-wrap justify-center gap-2">
              {challenge.methods.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={classNames(
                    "rounded-xl border px-4 py-2 text-xs font-semibold transition-all duration-200",
                    method === selectedMethod
                      ? "border-tiba-blue bg-tiba-blue/5 text-tiba-blue"
                      : "border-slate-200 bg-white text-slate-500 hover:border-tiba-blue/30"
                  )}
                  onClick={() => setSelectedMethod(method)}
                >
                  {method.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {resendOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="type-caption text-slate-500 text-center">Didn't receive a code?</span>
            <div className="flex flex-wrap justify-center gap-2">
              {resendOptions.map((method) => (
                <Button
                  key={method}
                  variant="ghost"
                  className="px-3 py-1 text-[10px] h-auto"
                  onClick={() => handleResend(method)}
                  loading={sendingMethod === method}
                  disabled={sendingMethod !== null}
                >
                  Resend via {method}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default TwoFactorPage;
