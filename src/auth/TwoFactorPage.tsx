import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";

import { Card } from "../shared/components/Card";
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
      <Card title="Two-factor authentication" description="Session expired">
        <p className="text-sm text-slate-600">We could not find an active verification request. Please sign in again.</p>
        <Button className="mt-4" onClick={() => navigate("/login", { replace: true })}>
          Back to login
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Verify it’s you" description={instructions}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Verification code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoFocus
          autoComplete="one-time-code"
          maxLength={8}
          inputMode="numeric"
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting} disabled={!code.trim() || submitting}>
          Confirm code
        </Button>
      </form>
      <div className="mt-6 space-y-4 text-sm text-slate-500">
        {challenge?.methods && challenge.methods.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Choose method:</span>
            {challenge.methods.map((method) => (
              <button
                key={method}
                type="button"
                className={classNames(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  method === selectedMethod
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-primary-300"
                )}
                onClick={() => setSelectedMethod(method)}
              >
                {method.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        {resendOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Need a new code?</span>
            {resendOptions.map((method) => (
              <Button
                key={method}
                variant="ghost"
                className="px-3 py-1 text-xs"
                onClick={() => handleResend(method)}
                loading={sendingMethod === method}
                disabled={sendingMethod !== null}
              >
                Send via {method}
              </Button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <button type="button" className="font-semibold text-primary-600 hover:text-primary-700" onClick={handleBackToLogin}>
            Cancel login
          </button>
          <span className="text-xs text-slate-400">Need another method? Contact support.</span>
        </div>
      </div>
    </Card>
  );
};

export default TwoFactorPage;
