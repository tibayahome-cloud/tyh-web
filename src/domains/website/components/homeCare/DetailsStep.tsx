import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { Input } from "../../../../shared/components/Input";
import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY, PHONE_PLACEHOLDER } from "../../../../shared/constants/contact";
import { CURRENT_LEGAL_DOCUMENTS, currentLegalDocumentPayload } from "../../../../shared/constants/legal";
import {
  createHomeCareRequest,
  homeCareErrorCode,
  homeCareRetryAfter,
  sendHomeCareCode,
  type HomeCareRequestResult
} from "../../../../shared/libs/homeCarePublic";
import { getApiError } from "../../../../shared/utils/errors";
import { botCheckConfigured, TurnstileCheck } from "./TurnstileCheck";
import { StepHeading } from "./ServiceStep";

type DetailsStepProps = {
  serviceId: string;
  facilityId: string;
  place: { lat: number; lng: number; address: string; landmark: string };
  scheduledAt: string | null;
  onDone: (result: HomeCareRequestResult, phone: string) => void;
};

type Problem = { message: string; callUs?: boolean; signIn?: boolean };

export const DetailsStep = ({ serviceId, facilityId, place, scheduledAt, onDone }: DetailsStepProps) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"code" | "request" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const onToken = useCallback((token: string | null) => setBotToken(token), []);

  const detailsOk = fullName.trim().length > 1 && phone.replace(/\D/g, "").length >= 9 && agreed && (!botCheckConfigured || botToken !== null);

  const explain = (error: unknown): Problem => {
    const reason = homeCareErrorCode(error);
    const message = getApiError(error, "Something went wrong. Please try again.");
    if (reason === "codes_unavailable") return { message, callUs: true };
    if (reason === "not_covered") return { message, callUs: true };
    return { message };
  };

  const askForCode = async () => {
    setBusy("code");
    setProblem(null);
    try {
      const answer = await sendHomeCareCode({
        phone,
        service_id: serviceId,
        lat: place.lat,
        lng: place.lng,
        ...(botToken ? { bot_token: botToken } : {})
      });
      if (answer.status === "sign_in") {
        setProblem({ message: "This number already has an account. Sign in to book your visit.", signIn: true });
        return;
      }
      setCodeSent(true);
      setCode("");
      setResendIn(answer.resend_after);
    } catch (error) {
      setProblem(explain(error));
      const wait = homeCareRetryAfter(error);
      if (wait && wait <= 600) setResendIn(wait);
    } finally {
      setBusy(null);
    }
  };

  const sendRequest = async () => {
    setBusy("request");
    setProblem(null);
    try {
      const result = await createHomeCareRequest({
        phone,
        code: code.trim(),
        full_name: fullName.trim(),
        service_id: serviceId,
        facility_id: facilityId,
        lat: place.lat,
        lng: place.lng,
        address_text: place.address.trim(),
        landmark: place.landmark.trim() || undefined,
        scheduled_at: scheduledAt,
        legal_documents: currentLegalDocumentPayload()
      });
      onDone(result, phone.trim());
    } catch (error) {
      const reason = homeCareErrorCode(error);
      setProblem(explain(error));
      if (reason === "code_expired") {
        setCodeSent(false);
        setCode("");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <StepHeading hint="We text you a code to check this number is yours. No password to make.">Who is the visit for?</StepHeading>

      <Input
        label="Full name"
        name="name"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        disabled={codeSent}
      />
      <Input
        label="Phone number"
        name="tel"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        placeholder={PHONE_PLACEHOLDER}
        hint="The clinic calls this number about your visit."
        onChange={(event) => setPhone(event.target.value)}
        disabled={codeSent}
      />

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            disabled={codeSent}
          />
          <span>
            I agree to the{" "}
            {CURRENT_LEGAL_DOCUMENTS.map((document, index) => (
              <span key={document.type}>
                {index > 0 && " and "}
                <a className="font-semibold underline underline-offset-2" href={document.url} target="_blank" rel="noreferrer">
                  {document.title}
                </a>
              </span>
            ))}
            .
          </span>
        </label>
      </div>

      {!codeSent && <TurnstileCheck onToken={onToken} />}

      {problem && (
        <div role="alert" className="rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-600">
          <p>{problem.message}</p>
          {problem.callUs && (
            <p className="mt-1">
              Call us on{" "}
              <a className="font-semibold underline underline-offset-2" href={`tel:${COMPANY_PHONE}`}>
                {COMPANY_PHONE_DISPLAY}
              </a>
              .
            </p>
          )}
          {problem.signIn && (
            <p className="mt-1">
              <Link className="font-semibold underline underline-offset-2" to="/login">
                Sign in
              </Link>
            </p>
          )}
        </div>
      )}

      {!codeSent ? (
        <Button type="button" size="lg" fullWidth disabled={!detailsOk} loading={busy === "code"} onClick={() => void askForCode()}>
          Text me a code
        </Button>
      ) : (
        <div className="space-y-3">
          <Input
            label="The 6-digit code we texted you"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            // The code field has just appeared and is the only thing left to do, so it takes focus.
            autoFocus
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          <Button type="button" size="lg" fullWidth disabled={code.length !== 6} loading={busy === "request"} onClick={() => void sendRequest()}>
            Request my visit
          </Button>
          <Button type="button" variant="ghost" fullWidth disabled={resendIn > 0 || busy !== null} onClick={() => void askForCode()}>
            {resendIn > 0 ? `Send a new code in ${resendIn} s` : "Send a new code"}
          </Button>
        </div>
      )}
    </div>
  );
};
