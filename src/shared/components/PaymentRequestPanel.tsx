import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Phone, AlertTriangle } from "lucide-react";

import { usePaymentRequest, useSendPaymentRequest } from "../hooks/usePaymentRequest";
import { getApiError } from "../utils/errors";
import { mpesaPhoneValidationError, normalizeMpesaPhone } from "../utils/mpesaPhone";
import { Button } from "./Button";

type Props = {
  bookingId: string;
  clientName: string;
  /** Called once the client has paid, so the page can move on. */
  onPaid?: () => void;
  /** Dark surfaces (the full-screen visit view) need light text. */
  tone?: "light" | "dark";
};

// "KES 2,500": the unit spelled out, the same on every device.
const money = (cents: number, currency: string) => `${currency} ${Math.round(cents / 100).toLocaleString("en-US")}`;

const secondsUntil = (iso: string | null, now: number) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0;

/**
 * After a home visit the provider asks the client to pay: one tap sends an M-Pesa prompt to the client's number, or to
 * another number the client gave. The panel shows where the request stands and only offers what the server would
 * accept: not while a prompt is out, not before the 60 seconds are up, not past the limit of three.
 */
export const PaymentRequestPanel = ({ bookingId, clientName, onPaid, tone = "light" }: Props) => {
  const query = usePaymentRequest(bookingId);
  const send = useSendPaymentRequest(bookingId);
  const [useOther, setUseOther] = useState(false);
  const [other, setOther] = useState("");
  const [touched, setTouched] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const data = query.data;
  const error = send.error ? getApiError(send.error, "The request could not be sent. Try again.") : null;

  // A visible countdown for the 60 seconds between requests, ticking only while it matters.
  const wait = secondsUntil(data?.canResendAt ?? null, now);
  useEffect(() => {
    if (!data?.canResendAt || wait === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [data?.canResendAt, wait]);

  useEffect(() => {
    if (data?.state === "paid") onPaid?.();
  }, [data?.state, onPaid]);

  const dark = tone === "dark";
  const text = dark ? "text-white" : "text-slate-900";
  const muted = dark ? "text-white/80" : "text-slate-700";
  const box = dark ? "border-white/15 bg-white/10" : "border-slate-200 bg-white";

  const otherError = useOther ? mpesaPhoneValidationError(other) : null;
  const submit = () => {
    setTouched(true);
    if (useOther) {
      const normalized = normalizeMpesaPhone(other);
      if (!normalized) return;
      send.mutate(`+${normalized}`);
    } else {
      send.mutate(undefined);
    }
  };

  if (query.isPending) {
    return <div className={`h-24 animate-pulse rounded-2xl motion-reduce:animate-none ${dark ? "bg-white/10" : "bg-slate-100"}`} aria-busy="true" />;
  }
  if (query.isError || !data) {
    return (
      <div role="alert" className={`rounded-2xl border p-4 text-sm ${box} ${muted}`}>
        <p>We could not check the payment request.</p>
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const amount = money(data.amountCents, data.currency);

  if (data.state === "paid") {
    return (
      <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 ${box}`}>
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <p className={`font-semibold ${text}`}>{clientName} paid {amount}</p>
          <p className={`text-sm ${muted}`}>The visit is closed and your earnings are on their way.</p>
        </div>
      </div>
    );
  }

  if (data.state === "exhausted") {
    return (
      <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 ${box}`}>
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className={`font-semibold ${text}`}>The payment was not completed</p>
          <p className={`text-sm ${muted}`}>
            You have sent all {data.maxPrompts} requests. The facility will follow up with {clientName}.
          </p>
        </div>
      </div>
    );
  }

  const outstanding = data.state === "sending" || data.state === "waiting";
  const canSend = !send.isPending && !outstanding && wait === 0;

  return (
    <div className={`space-y-3 rounded-2xl border p-4 ${box}`}>
      {data.state !== "none" && (
        <div role="status" className="flex items-start gap-3">
          {outstanding ? (
            <Clock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          ) : (
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          )}
          <div>
            <p className={`font-semibold ${text}`}>
              {outstanding ? `Waiting for ${clientName} to approve` : "The last request did not go through"}
            </p>
            <p className={`text-sm ${muted}`}>
              {data.payerPhoneMasked ? `Sent to ${data.payerPhoneMasked}. ` : ""}
              Request {data.promptsSent} of {data.maxPrompts}.
            </p>
          </div>
        </div>
      )}

      {!outstanding && (
        <>
          {data.state === "none" && (
            <p className={`text-sm ${muted}`}>
              Ask {clientName} to pay {amount}. They approve it on their phone.
            </p>
          )}
          <fieldset className="space-y-2">
            <legend className={`text-sm font-medium ${text}`}>Send the request to</legend>
            <label className={`flex min-h-[44px] items-center gap-3 text-sm ${muted}`}>
              <input type="radio" name={`payer-${bookingId}`} checked={!useOther} onChange={() => setUseOther(false)} />
              {clientName}&apos;s number on their account
            </label>
            <label className={`flex min-h-[44px] items-center gap-3 text-sm ${muted}`}>
              <input type="radio" name={`payer-${bookingId}`} checked={useOther} onChange={() => setUseOther(true)} />
              A different number
            </label>
            {useOther && (
              <div>
                <label className="block">
                  <span className={`mb-1 flex items-center gap-2 text-sm font-medium ${text}`}>
                    <Phone aria-hidden="true" className="h-4 w-4" /> Number to charge
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={other}
                    onChange={(event) => setOther(event.target.value)}
                    onBlur={() => setTouched(true)}
                    placeholder="0712 345 678"
                    aria-invalid={touched && Boolean(otherError)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
                  />
                </label>
                {touched && otherError && <p className="mt-1 text-sm text-rose-600">{otherError}</p>}
              </div>
            )}
          </fieldset>
        </>
      )}

      {error && (
        <p role="alert" className={`text-sm ${dark ? "text-rose-200" : "text-rose-700"}`}>
          {error}
        </p>
      )}

      {!outstanding && (
        <Button type="button" className="w-full" disabled={!canSend} loading={send.isPending} onClick={submit}>
          {wait > 0
            ? `Send again in ${wait} s`
            : data.state === "failed"
              ? "Send the request again"
              : `Send payment request for ${amount}`}
        </Button>
      )}
    </div>
  );
};
