import { useReducer, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldQuestion } from "lucide-react";

import { Button } from "./Button";
import { Input } from "./Input";
import {
  MPESA_DESTINATION_LOOKUP_ENABLED,
  classifyOtpFailure,
  initialPayoutVerificationState,
  isPlausiblePhoneFormat,
  payoutVerificationReducer,
  type PayoutDestinationResponse,
  type PayoutLookupResponse
} from "../libs/payoutDestinationVerification";
import { getApiError } from "../utils/errors";

export type PayoutDestinationVerifierProps = {
  label?: string;
  helperText?: string;
  requestCode: (phoneNumber: string) => Promise<PayoutDestinationResponse>;
  verifyCode: (phoneNumber: string, code: string) => Promise<PayoutDestinationResponse>;
  /** Only called when MPESA_DESTINATION_LOOKUP_ENABLED is true. No real implementation exists
   * in this codebase today -- pass one only from a test or a future, confirmed integration. */
  lookupDestination?: (phoneNumber: string) => Promise<PayoutLookupResponse>;
  /** Called once verification succeeds, immediately (already-verified number) or after OTP.
   * `phoneNumber` is the raw value the caller submitted -- needed by callers that must pass it
   * on to another request (e.g. a per-withdrawal payout override), since the response only ever
   * carries the backend's masked form. */
  onVerified?: (response: PayoutDestinationResponse, phoneNumber: string) => void;
  disabled?: boolean;
};

const LOOKUP_OUTCOME_COPY: Record<string, { tone: "info" | "warning" | "success"; text: string }> = {
  verified_safaricom: { tone: "success", text: "Safaricom number confirmed." },
  unsupported_network: {
    tone: "warning",
    text: "This doesn't look like a Safaricom number. You can still continue — payouts are not blocked by this check."
  },
  name_unavailable: {
    tone: "info",
    text: "Number verified on the network, but we couldn't confirm an account name for it."
  },
  lookup_unavailable: {
    tone: "info",
    text: "We couldn't check this number right now. You can continue — this doesn't affect verification."
  },
  verification_not_configured: {
    tone: "info",
    text: "Number lookup isn't available yet."
  }
};

const TONE_CLASSES: Record<"info" | "warning" | "success", string> = {
  info: "bg-slate-50 text-slate-600",
  warning: "bg-amber-50 text-amber-800",
  success: "bg-emerald-50 text-emerald-700"
};

export const PayoutDestinationVerifier = ({
  label = "M-Pesa payout number",
  helperText,
  requestCode,
  verifyCode,
  lookupDestination,
  onVerified,
  disabled = false
}: PayoutDestinationVerifierProps) => {
  const [state, dispatch] = useReducer(payoutVerificationReducer, initialPayoutVerificationState);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lookupActive = MPESA_DESTINATION_LOOKUP_ENABLED && Boolean(lookupDestination);

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    setCode("");
    setErrorMessage(null);
    dispatch({ type: "PHONE_CHANGED", value });
  };

  const runLookup = async (number: string) => {
    if (!lookupActive || !lookupDestination) return;
    dispatch({ type: "LOOKUP_STARTED" });
    try {
      const result = await lookupDestination(number);
      dispatch({ type: "LOOKUP_SUCCEEDED", result });
    } catch {
      dispatch({ type: "LOOKUP_FAILED" });
    }
  };

  const handleSendCode = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) return;
    setErrorMessage(null);
    if (lookupActive && state.phase === "format_valid") {
      await runLookup(trimmed);
    }
    dispatch({ type: "CODE_REQUESTED" });
    try {
      const response = await requestCode(trimmed);
      dispatch({ type: "CODE_SENT", response });
      if (response.verified) {
        onVerified?.(response, trimmed);
      }
    } catch (error) {
      setErrorMessage(getApiError(error, "Unable to send a verification code. Try again."));
      dispatch({ type: "CODE_REQUEST_FAILED" });
    }
  };

  const handleVerify = async () => {
    const trimmedCode = code.trim();
    const trimmedPhone = phoneNumber.trim();
    if (!trimmedCode || !trimmedPhone) return;
    setErrorMessage(null);
    dispatch({ type: "OTP_SUBMITTED" });
    try {
      const response = await verifyCode(trimmedPhone, trimmedCode);
      dispatch({ type: "OTP_VERIFIED", response });
      onVerified?.(response, trimmedPhone);
    } catch (error) {
      const message = getApiError(error, "That code didn't work. Try again.");
      setErrorMessage(message);
      dispatch({ type: "OTP_FAILED", reason: classifyOtpFailure(message) });
    }
  };

  const isBusy = state.phase === "looking_up" || state.phase === "sending_code" || state.phase === "verifying_code";
  const canSendCode = isPlausiblePhoneFormat(phoneNumber) && !isBusy && !disabled;
  const lookupCopy = state.lookupOutcome ? LOOKUP_OUTCOME_COPY[state.lookupOutcome] : null;

  if (state.phase === "verified_locked") {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Send payout to {state.phoneMasked ?? "the verified number"}
            </p>
            {state.accountName && (
              <p className="mt-1 text-sm text-emerald-700">Account name: {state.accountName}</p>
            )}
            <p className="mt-1 text-xs text-emerald-700">This destination is verified and locked to this withdrawal.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Input
          label={label}
          type="tel"
          inputMode="tel"
          placeholder="07xx xxx xxx"
          value={phoneNumber}
          disabled={disabled}
          onChange={(event) => handlePhoneChange(event.target.value)}
          hint={helperText}
          error={state.phase === "format_invalid" ? "Enter a valid Kenyan mobile number." : undefined}
        />
        <Button type="button" variant="outline" disabled={!canSendCode} loading={state.phase === "sending_code" || state.phase === "looking_up"} onClick={handleSendCode}>
          Send code
        </Button>
      </div>

      {state.phase === "looking_up" && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="animate-spin motion-reduce:animate-none" size={14} aria-hidden />
          Checking this number…
        </p>
      )}

      {lookupCopy && (
        <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${TONE_CLASSES[lookupCopy.tone]}`}>
          {lookupCopy.tone === "warning" ? (
            <AlertTriangle className="mt-0.5 shrink-0" size={14} aria-hidden />
          ) : lookupCopy.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 shrink-0" size={14} aria-hidden />
          ) : (
            <ShieldQuestion className="mt-0.5 shrink-0" size={14} aria-hidden />
          )}
          {lookupCopy.text}
        </p>
      )}

      {state.lookupOutcome === "name_verified" && state.accountName && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          Account name: {state.accountName}
        </p>
      )}

      {(state.phase === "otp_required" || state.phase === "verifying_code" || state.phase === "otp_failed") && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            We sent a code to {state.phoneMasked ?? "your number"}.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Verification code"
              inputMode="numeric"
              value={code}
              disabled={disabled}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="button" disabled={!code.trim() || disabled} loading={state.phase === "verifying_code"} onClick={handleVerify}>
              Verify
            </Button>
          </div>
          {state.phase === "otp_failed" && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 shrink-0" size={14} aria-hidden />
              <div>
                <p className="font-semibold">
                  {state.otpFailureReason === "expired" ? "That code has expired." : "That code didn't work."}
                </p>
                <p className="mt-0.5">
                  {state.otpFailureReason === "expired"
                    ? "Request a new code and try again."
                    : "Check the code and try again, or request a new one."}
                </p>
                <button
                  type="button"
                  className="mt-1 font-semibold underline"
                  onClick={handleSendCode}
                  disabled={isBusy || disabled}
                >
                  Send a new code
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {errorMessage && state.phase !== "otp_failed" && (
        <p className="text-xs text-rose-600">{errorMessage}</p>
      )}
    </div>
  );
};

export default PayoutDestinationVerifier;
