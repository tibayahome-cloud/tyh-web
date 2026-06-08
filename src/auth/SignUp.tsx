import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { Phone, CheckCircle2, Loader2 } from "lucide-react";

import { AuthLayout } from "../shared/components/AuthLayout";
import { FormField } from "../shared/components/FormField";
import { Input } from "../shared/components/Input";
import { PasswordField } from "../shared/components/PasswordField";
import { Button } from "../shared/components/Button";
import type { RegisterSchema } from "../shared/schemas/auth";
import { registerSchema } from "../shared/schemas/auth";
import api from "../shared/libs/api";
import { PHONE_PLACEHOLDER } from "../shared/constants/contact";

const defaultValues: RegisterSchema = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: ""
};

type Step = "register" | "verify" | "success";

export const SignUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("register");
  const [error, setError] = useState<string | null>(null);
  const [registeredPhone, setRegisteredPhone] = useState<string>("");
  const [otpCode, setOtpCode] = useState("");
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const response = await api.post("/auth/register", {
        full_name: values.fullName.trim(),
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        password: values.password
      });

      const meta = response.data?.meta;
      if (values.phone?.trim()) {
        setRegisteredPhone(values.phone.trim());

        if (meta?.verification_required && meta?.otp_sent) {
          setStep("verify");
        } else {
          try {
            const loginRes = await api.post("/auth/login", {
              emailOrPhone: values.phone.trim(),
              password: values.password
            });
            if (loginRes.data?.data?.access_token) {
              setAccessToken(loginRes.data.data.access_token);
            }
            setStep("success");
          } catch {
            setStep("verify");
          }
        }
      } else {
        setStep("success");
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        const message = (err.response?.data as { message?: string })?.message;
        setError(message ?? t("auth.signUpError"));
      } else {
        setError(t("auth.signUpError"));
      }
    }
  });

  const handleVerify = async () => {
    if (!otpCode || otpCode.length < 4) {
      setError("Please enter a valid code");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await api.post(
        "/auth/verify/phone/confirm",
        { code: otpCode },
        { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }
      );
      setStep("success");
    } catch (err) {
      if (err instanceof AxiosError) {
        const message = (err.response?.data as { message?: string })?.message;
        setError(message ?? "Invalid code. Please try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResending(true);
    try {
      await api.post(
        "/auth/verify/phone/init",
        {},
        { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }
      );
    } catch (err) {
      if (err instanceof AxiosError) {
        const message = (err.response?.data as { message?: string })?.message;
        setError(message ?? "Failed to resend code");
      }
    } finally {
      setResending(false);
    }
  };

  if (step === "success") {
    return (
      <AuthLayout
        title="Account Verified!"
        subtitle="Your account is ready to use."
        footer={null}
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-slate-600 mb-6">
            You can now sign in and start booking services.
          </p>
          <Button onClick={() => navigate("/login")} className="w-full">
            Sign In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (step === "verify") {
    return (
      <AuthLayout
        title="Verify Your Phone"
        subtitle={`We sent a code to ${registeredPhone}`}
        footer={
          <p className="type-caption text-slate-500">
            Didn't receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-tiba-blue hover:underline disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend Code"}
            </button>
          </p>
        }
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Phone className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Enter verification code
            </label>
            <Input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
              <p className="type-caption text-red-600">{error}</p>
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={verifying || otpCode.length < 4}
            className="w-full h-11"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              "Verify Phone"
            )}
          </Button>

          <p className="text-xs text-center text-slate-500">
            Verification is required to book services
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.signUpTitle")}
      subtitle="Join our community for a premium care experience."
      footer={
        <p className="type-caption text-slate-500">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-tiba-blue hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormField
          control={control}
          name="fullName"
          render={({ field, fieldState }) => (
            <Input {...field} label={t("auth.fullName")} autoComplete="name" error={fieldState.error?.message} />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                type="email"
                label={t("auth.email")}
                placeholder="jane@example.com"
                autoComplete="email"
                error={fieldState.error?.message}
              />
            )}
          />

          <FormField
            control={control}
            name="phone"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label={t("auth.phone")}
                placeholder={PHONE_PLACEHOLDER}
                autoComplete="tel"
                error={fieldState.error?.message}
              />
            )}
          />
        </div>

        <FormField
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label={t("auth.password")}
              autoComplete="new-password"
              error={fieldState.error?.message}
            />
          )}
        />

        <FormField
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label={t("auth.confirmPassword")}
              autoComplete="new-password"
              error={fieldState.error?.message}
            />
          )}
        />

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
            <p className="type-caption text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full h-11" loading={isSubmitting}>
          {t("auth.signUpCta")}
        </Button>

        <p className="text-xs text-center text-slate-500">
          Phone verification required after registration
        </p>
      </form>
    </AuthLayout>
  );
};

export default SignUp;
