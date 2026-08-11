import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, LogOut, ShieldCheck } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";

import { AuthLayout } from "../shared/components/AuthLayout";
import { Button } from "../shared/components/Button";
import { Loading } from "../shared/components/Loading";
import api from "../shared/libs/api";
import { CURRENT_LEGAL_DOCUMENTS, currentLegalDocumentPayload } from "../shared/constants/legal";
import { useAuth } from "../shared/hooks/useAuth";
import { legalConsentIsComplete } from "../shared/schemas/legal";
import type { LegalDocumentType } from "../shared/constants/legal";

const resolveReturnPath = (state: unknown) => {
  if (!state || typeof state !== "object") {
    return "/app";
  }
  const from = (state as { from?: unknown }).from;
  if (!from || typeof from !== "object") {
    return "/app";
  }
  const pathname = (from as { pathname?: unknown }).pathname;
  if (typeof pathname !== "string" || pathname === "/legal/consent") {
    return "/app";
  }
  const search = (from as { search?: unknown }).search;
  return `${pathname}${typeof search === "string" ? search : ""}`;
};

const resolveError = (error: unknown) => {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return payload?.error?.message ?? payload?.message ?? "We could not record your consent.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "We could not record your consent.";
};

export const LegalConsentPage = () => {
  const { user, isAuthenticated, isBootstrapping, bootstrapMe, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState<Record<LegalDocumentType, boolean>>({
    terms: false,
    privacy: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnPath = useMemo(() => resolveReturnPath(location.state), [location.state]);
  const missingTypes = useMemo(() => {
    const summary = user?.legalConsent;
    if (!summary?.required) {
      return new Set<LegalDocumentType>();
    }
    return new Set(
      summary.documents
        .filter((document) => !document.accepted)
        .map((document) => document.type)
    );
  }, [user?.legalConsent]);

  useEffect(() => {
    if (!isAuthenticated || user?.legalConsent || isBootstrapping) {
      return;
    }
    setChecking(true);
    bootstrapMe().finally(() => setChecking(false));
  }, [bootstrapMe, isAuthenticated, isBootstrapping, user?.legalConsent]);

  useEffect(() => {
    if (user?.legalConsent && legalConsentIsComplete(user.legalConsent)) {
      navigate(returnPath, { replace: true });
    }
  }, [navigate, returnPath, user?.legalConsent]);

  if (!isAuthenticated && !isBootstrapping) {
    return <NavigateToLogin />;
  }

  if (isBootstrapping || checking || !user?.legalConsent) {
    return (
      <AuthLayout title="Account requirements" subtitle="Checking your account status.">
        <Loading label="Loading legal documents" />
      </AuthLayout>
    );
  }

  const canSubmit = CURRENT_LEGAL_DOCUMENTS.every((document) => {
    if (!missingTypes.has(document.type)) {
      return true;
    }
    return accepted[document.type];
  });

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/legal-consents", {
        documents: currentLegalDocumentPayload()
      });
      await bootstrapMe();
      navigate(returnPath, { replace: true });
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Review legal documents"
      subtitle="Accept the current Terms and acknowledge the Privacy Policy to continue."
      maxWidth="max-w-2xl"
      footer={
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-tiba-blue" />
            <p>
              These documents apply to clients, providers, facility admins, and platform admins.
              Your acceptance is recorded against the published version shown below.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {CURRENT_LEGAL_DOCUMENTS.map((document) => {
            const isMissing = missingTypes.has(document.type);
            const checked = isMissing ? accepted[document.type] : true;
            return (
              <div key={document.type} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-1 h-5 w-5 shrink-0 text-tiba-blue" />
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{document.title}</h2>
                      <p className="text-sm text-slate-500">
                        {document.version} effective {document.effectiveDate}
                      </p>
                    </div>
                  </div>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-tiba-blue hover:underline"
                  >
                    Open PDF
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
                    checked={checked}
                    disabled={!isMissing}
                    onChange={(event) =>
                      setAccepted((current) => ({
                        ...current,
                        [document.type]: event.target.checked
                      }))
                    }
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {isMissing ? document.actionLabel : "Already recorded for this version."}
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="button" className="w-full h-11" disabled={!canSubmit} loading={submitting} onClick={submit}>
          Continue
        </Button>
      </div>
    </AuthLayout>
  );
};

const NavigateToLogin = () => {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: location }} />;
};

export default LegalConsentPage;
