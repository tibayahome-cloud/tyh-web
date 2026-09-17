import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Input } from "../../../../shared/components/Input";
import ApiErrorBanner from "../../../../shared/components/ApiErrorBanner";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
  authorizeFacilityPayoutDestinationChange,
  fetchPendingFacilityPayoutDestinationChange,
  fetchFacilityPayoutTrustedMethods,
  resendFacilityPayoutDestinationCode,
  startFacilityPayoutDestinationChange,
  verifyNewFacilityPayoutDestination,
  type FacilityPayoutDestinationChange
} from "../../../../shared/libs/wallet";
import { classifyApiError, getApiError } from "../../../../shared/utils/errors";

const AUTHORIZATION_PURPOSE = "fac_dest_authorization";
const POSSESSION_PURPOSE = "fac_dest_possession";

type Props = {
  facilityId: string;
  open: boolean;
  onCompleted: () => void;
};

export const FacilityPayoutDestinationChangeVerifier = ({ facilityId, open, onCompleted }: Props) => {
  const toast = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [alternateMethod, setAlternateMethod] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<FacilityPayoutDestinationChange | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const methodsQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "payout-trusted-methods"],
    queryFn: () => fetchFacilityPayoutTrustedMethods(facilityId),
    enabled: open
  });

  const pendingQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "payout-destination-change", "pending"],
    queryFn: () => fetchPendingFacilityPayoutDestinationChange(facilityId),
    enabled: open
  });

  useEffect(() => {
    if (!open) {
      setPhoneNumber("");
      setSelectedMethod("");
      setAlternateMethod("");
      setCode("");
      setChallenge(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (pendingQuery.data) setChallenge(pendingQuery.data);
  }, [pendingQuery.data]);

  useEffect(() => {
    if (!challenge?.resendAvailableAt) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge?.resendAvailableAt]);

  useEffect(() => {
    if (!selectedMethod && methodsQuery.data?.length) {
      setSelectedMethod(methodsQuery.data[0].optionId);
    }
  }, [methodsQuery.data, selectedMethod]);

  const run = async (operation: () => Promise<FacilityPayoutDestinationChange>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await operation();
      setChallenge(result);
      setCode("");
      if (success) toast.showToast({ title: success, variant: "success" });
      if (result.completed) {
        toast.showToast({
          title: "Payout destination updated",
          description: "The new number is now active.",
          variant: "success"
        });
        onCompleted();
      }
    } catch (err) {
      setError(getApiError(err, "We could not complete this verification step. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (!phoneNumber.trim() || !selectedMethod) return;
    const idempotencyKey = crypto.randomUUID();
    void run(() => startFacilityPayoutDestinationChange(facilityId, {
      newPhoneNumber: phoneNumber.trim(),
      optionId: selectedMethod,
      idempotencyKey
    }));
  };

  const authorize = () => {
    if (!challenge || !code.trim()) return;
    void run(
      () => authorizeFacilityPayoutDestinationChange(facilityId, challenge.changeId, code.trim()),
      "Authorization accepted"
    );
  };

  const verifyNew = () => {
    if (!challenge || !code.trim()) return;
    void run(verifyNewFacilityPayoutDestination.bind(null, facilityId, challenge.changeId, code.trim()));
  };

  if (methodsQuery.isLoading || pendingQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading trusted verification methods…</p>;
  }

  if (methodsQuery.isError || pendingQuery.isError) {
    const classified = classifyApiError(
      methodsQuery.error ?? pendingQuery.error,
      "We could not load the payout destination verification state."
    );
    return (
      <ApiErrorBanner
        {...classified}
        onRetry={() => {
          void methodsQuery.refetch();
          void pendingQuery.refetch();
        }}
      />
    );
  }

  if (!challenge) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          First authorize this change using a trusted facility contact. We will then send a second code to the new M-Pesa number.
        </p>
        <Input
          label="New M-Pesa payout number"
          type="tel"
          inputMode="tel"
          placeholder="07xx xxx xxx"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        {methodsQuery.data?.length ? (
          <label className="block text-sm font-medium text-slate-700">
            Send authorization code to
            <select
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              value={selectedMethod}
              onChange={(event) => setSelectedMethod(event.target.value)}
            >
              {methodsQuery.data.map((method) => (
                <option key={method.optionId} value={method.optionId}>{method.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No verified trusted contact is available for this facility. Ask a super-admin to recover the destination.
          </p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="button" disabled={!phoneNumber.trim() || !selectedMethod} loading={busy} onClick={start}>
          Send authorization code
        </Button>
      </div>
    );
  }

  const authorized = challenge.status === "authorized";
  const purpose = authorized ? POSSESSION_PURPOSE : AUTHORIZATION_PURPOSE;
  const resendWaitSeconds = Math.max(
    0,
    Math.ceil((new Date(challenge.resendAvailableAt ?? 0).getTime() - nowMs) / 1000)
  );
  const resendWaitLabel = `${Math.floor(resendWaitSeconds / 60).toString().padStart(2, "0")}:${(resendWaitSeconds % 60).toString().padStart(2, "0")}`;
  const alternateMethods = (methodsQuery.data ?? []).filter(
    (method) => method.optionId !== challenge.authorizationOptionId
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {authorized ? (
          <>Authorization accepted. A possession code was sent to <strong>{challenge.newPhoneMasked}</strong>.</>
        ) : (
          <>Enter the authorization code sent to <strong>{challenge.authorizationTargetMasked}</strong>.</>
        )}
      </div>
      <Input
        label={authorized ? "New-number verification code" : "Authorization code"}
        inputMode="numeric"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!code.trim()} loading={busy} onClick={authorized ? verifyNew : authorize}>
          {authorized ? "Verify new number" : "Authorize change"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || resendWaitSeconds > 0}
          onClick={() => void run(() => resendFacilityPayoutDestinationCode(facilityId, challenge.changeId, purpose), "A new code was sent")}
        >
          {resendWaitSeconds > 0 ? `Resend code (${resendWaitLabel})` : "Resend code"}
        </Button>
      </div>
      {!authorized && alternateMethods.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">Didn&apos;t receive the code?</p>
          <p className="mt-1 text-xs text-slate-600">Send a replacement code through another verified facility contact.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm font-medium text-slate-700">
              Send replacement to
              <select
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                value={alternateMethod}
                onChange={(event) => setAlternateMethod(event.target.value)}
              >
                <option value="">Choose a verified contact</option>
                {alternateMethods.map((method) => (
                  <option key={method.optionId} value={method.optionId}>{method.label}</option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={!alternateMethod || busy || resendWaitSeconds > 0}
              loading={busy}
              onClick={() => void run(
                () => resendFacilityPayoutDestinationCode(
                  facilityId,
                  challenge.changeId,
                  AUTHORIZATION_PURPOSE,
                  alternateMethod
                ),
                "A replacement code was sent"
              )}
            >
              {resendWaitSeconds > 0 ? `Try another contact (${resendWaitLabel})` : "Try another contact"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
};

export default FacilityPayoutDestinationChangeVerifier;
