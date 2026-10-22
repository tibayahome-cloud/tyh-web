import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, RefreshCw, CheckCircle2, UserPlus } from "lucide-react";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";

import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { useToast } from "./ToastProvider";
import { api } from "../libs/api";
import { useAuth } from "../hooks/useAuth";
import { getApiError } from "../utils/errors";
import { CODE_LENGTH, cleanCode, maskPhone, toDeliveryState, type DeliveryState } from "../utils/phoneVerification";

type PhoneVerificationPromptProps = {
  open: boolean;
  onClose: () => void;
  onVerified?: () => void;
};

const RESEND_WAIT_SECONDS = 30;
const STATUS_POLL_MS = 2000;
const STATUS_POLL_LIMIT = 8;

export const PhoneVerificationPrompt = ({ open, onClose, onVerified }: PhoneVerificationPromptProps) => {
  const { user, bootstrapMe } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryState>("none");
  const [resendIn, setResendIn] = useState(0);
  const [noPhone, setNoPhone] = useState(false);
  const pollToken = useRef(0);

  const maskedPhone = maskPhone(user?.phone);

  // Count the resend wait down once a second. The wait exists so a person does not tap again before a code
  // has had time to arrive, which only queues more texts.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // After asking for a code, find out whether it was actually sent. "Code sent" was shown as soon as the request
  // was queued, so a failure at the SMS gateway left someone waiting for a code that was never coming. An API
  // without the status call simply keeps the "sent" wording it always had.
  const watchDelivery = useCallback(async () => {
    const token = ++pollToken.current;
    for (let attempt = 0; attempt < STATUS_POLL_LIMIT; attempt += 1) {
      try {
        const response = await api.get("/auth/verify/phone/status");
        if (token !== pollToken.current) return;
        const state = toDeliveryState(response.data?.data?.delivery);
        if (state === "sent" || state === "failed") {
          setDelivery(state);
          return;
        }
        if (state === "none") {
          setDelivery("sent");
          return;
        }
      } catch {
        if (token === pollToken.current) setDelivery("sent");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
    }
    if (token === pollToken.current) setDelivery("sent");
  }, []);

  useEffect(() => () => void (pollToken.current += 1), []);

  const handleSendOtp = async () => {
    setOtpError(null);
    setNoPhone(false);
    setOtpSending(true);
    try {
      await api.post("/auth/verify/phone/init");
      setRequested(true);
      setDelivery("pending");
      setOtpCode("");
      setResendIn(RESEND_WAIT_SECONDS);
      void watchDelivery();
    } catch (err) {
      const message = getApiError(err, "We could not send a code. Try again.");
      if (err instanceof AxiosError && message.toLowerCase().includes("no phone")) {
        setNoPhone(true);
      } else {
        setOtpError(message);
      }
    } finally {
      setOtpSending(false);
    }
  };

  const handleGoToProfile = () => {
    handleClose();
    navigate("/app/profile");
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== CODE_LENGTH) {
      setOtpError(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    setOtpError(null);
    setOtpVerifying(true);
    try {
      await api.post("/auth/verify/phone/confirm", { code: otpCode });
      showToast({
        title: "Phone confirmed",
        description: "Your phone number is confirmed.",
        variant: "success"
      });
      // Refresh user data to update phoneVerifiedAt
      await bootstrapMe();
      onVerified?.();
      handleClose();
    } catch (err) {
      setOtpError(getApiError(err, "We could not check that code. Try again."));
    } finally {
      setOtpVerifying(false);
    }
  };

  function handleClose() {
    pollToken.current += 1;
    setOtpCode("");
    setOtpError(null);
    setRequested(false);
    setDelivery("none");
    setResendIn(0);
    setNoPhone(false);
    onClose();
  }

  const codeSent = requested && delivery === "sent";
  const sendFailed = requested && delivery === "failed";

  const intro = noPhone
    ? "Add a phone number to your profile first."
    : sendFailed
      ? "We could not send the code right now. Try again shortly."
      : requested && delivery === "pending"
        ? "Sending your code…"
        : codeSent
          ? `We sent a ${CODE_LENGTH}-digit code to ${maskedPhone}.`
          : `We will text a ${CODE_LENGTH}-digit code to ${maskedPhone}.`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Confirm your phone number"
      description="We use it to reach you about your appointments."
      maxWidth="sm"
    >
      <div className="space-y-6 py-4">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            {noPhone ? <UserPlus className="h-8 w-8 text-amber-700" /> : <Phone className="h-8 w-8 text-amber-700" />}
          </div>
          <p role="status" className="text-sm text-slate-700">
            {intro}
          </p>
        </div>

        {noPhone ? (
          <Button type="button" fullWidth onClick={handleGoToProfile} className="h-12">
            <UserPlus className="mr-2 h-4 w-4" />
            Go to profile
          </Button>
        ) : !requested || sendFailed ? (
          <Button type="button" fullWidth onClick={handleSendOtp} disabled={otpSending} className="h-12">
            {otpSending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : sendFailed ? (
              "Try again"
            ) : (
              "Send code"
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <Input
              label="Verification code"
              name="verification-code"
              placeholder="123456"
              value={otpCode}
              onChange={(event) => setOtpCode(cleanCode(event.target.value))}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />

            <Button
              type="button"
              fullWidth
              onClick={handleVerifyOtp}
              disabled={otpVerifying || otpCode.length !== CODE_LENGTH}
              className="h-12"
            >
              {otpVerifying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm phone
                </>
              )}
            </Button>

            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpSending || resendIn > 0}
                className="min-h-[44px] px-3 text-sm font-medium text-tiba-blue hover:underline disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
              >
                {otpSending ? "Sending..." : resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
              </button>
              <button
                type="button"
                onClick={handleGoToProfile}
                className="min-h-[44px] px-3 text-sm font-medium text-slate-700 hover:underline"
              >
                Wrong number? Change it
              </button>
            </div>
          </div>
        )}

        {otpError && (
          <p role="alert" className="text-center text-sm text-red-700">
            {otpError}
          </p>
        )}

        <button
          type="button"
          onClick={handleClose}
          className="min-h-[44px] w-full text-sm text-slate-600 hover:text-slate-800"
        >
          Not now
        </button>
      </div>
    </Modal>
  );
};
