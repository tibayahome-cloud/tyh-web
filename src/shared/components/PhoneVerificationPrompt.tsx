import { useState } from "react";
import { Phone, RefreshCw, CheckCircle2, UserPlus } from "lucide-react";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";

import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { useToast } from "./ToastProvider";
import { api } from "../libs/api";
import { useAuth } from "../hooks/useAuth";

type PhoneVerificationPromptProps = {
  open: boolean;
  onClose: () => void;
  onVerified?: () => void;
};

export const PhoneVerificationPrompt = ({
  open,
  onClose,
  onVerified
}: PhoneVerificationPromptProps) => {
  const { user, bootstrapMe } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [noPhone, setNoPhone] = useState(false);

  const maskedPhone = user?.phone
    ? `${user.phone.slice(0, 4)}****${user.phone.slice(-3)}`
    : "your phone";

  const handleSendOtp = async () => {
    setOtpError(null);
    setNoPhone(false);
    setOtpSending(true);
    try {
      await api.post("/auth/verify/phone/init");
      setOtpSent(true);
      showToast({
        title: "Code sent",
        description: `Verification code sent to ${maskedPhone}`,
        variant: "success"
      });
    } catch (err) {
      if (err instanceof AxiosError) {
        const message =
          err.response?.data?.error?.message ?? "Failed to send code. Please try again.";
        if (message.toLowerCase().includes("no phone")) {
          setNoPhone(true);
        } else {
          setOtpError(message);
        }
      } else {
        setOtpError("Failed to send code. Please try again.");
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
    if (!otpCode || otpCode.length < 4) {
      setOtpError("Please enter the verification code.");
      return;
    }
    setOtpError(null);
    setOtpVerifying(true);
    try {
      await api.post("/auth/verify/phone/confirm", { code: otpCode });
      showToast({
        title: "Phone verified",
        description: "Your phone number has been verified successfully.",
        variant: "success"
      });
      // Refresh user data to update phoneVerifiedAt
      await bootstrapMe();
      onVerified?.();
      handleClose();
    } catch (err) {
      if (err instanceof AxiosError) {
        const message =
          err.response?.data?.error?.message ?? "Invalid code. Please try again.";
        setOtpError(message);
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleClose = () => {
    setOtpCode("");
    setOtpError(null);
    setOtpSent(false);
    setNoPhone(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Verify Your Phone Number"
      description="Phone verification is required to access all features."
      maxWidth="sm"
    >
      <div className="py-4 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            {noPhone ? (
              <UserPlus className="w-8 h-8 text-amber-600" />
            ) : (
              <Phone className="w-8 h-8 text-amber-600" />
            )}
          </div>
          <p className="text-slate-600 text-sm">
            {noPhone
              ? "Please add a phone number to your profile first."
              : otpSent
                ? `Enter the 6-digit code sent to ${maskedPhone}`
                : `We'll send a verification code to ${maskedPhone}`}
          </p>
        </div>

        {noPhone ? (
          <Button
            type="button"
            fullWidth
            onClick={handleGoToProfile}
            className="h-12"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Go to Profile
          </Button>
        ) : !otpSent ? (
          <Button
            type="button"
            fullWidth
            onClick={handleSendOtp}
            disabled={otpSending}
            className="h-12"
          >
            {otpSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              "Send Verification Code"
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <Input
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />

            <Button
              type="button"
              fullWidth
              onClick={handleVerifyOtp}
              disabled={otpVerifying || otpCode.length < 4}
              className="h-12"
            >
              {otpVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Verify Phone
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={otpSending}
              className="w-full text-sm text-tiba-blue hover:underline disabled:opacity-50"
            >
              {otpSending ? "Sending..." : "Resend code"}
            </button>
          </div>
        )}

        {otpError && <p className="text-sm text-red-600 text-center">{otpError}</p>}

        <button
          type="button"
          onClick={handleClose}
          className="w-full text-sm text-slate-500 hover:text-slate-700"
        >
          I'll do this later
        </button>
      </div>
    </Modal>
  );
};
