import { useEffect, useId, useState } from "react";

import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { hasUsableSavedNumber, resolvePayer, type PayerMode } from "../utils/payerPhone";

type HomeCarePaymentActionsProps = {
  // The phone number on the client's account. Read only: it is never changed here.
  savedPhone: string | null | undefined;
  amountCents: number;
  currency?: string;
  // A request is in flight: inputs lock and the confirm button shows progress.
  isPending: boolean;
  // The last attempt failed; the confirm button becomes "Try again" and the entry is kept.
  failed: boolean;
  // Changing this (a different booking) puts the choice back to the saved number.
  resetKey: string | null;
  // Called with the number to charge, already validated and normalised.
  onConfirm: (phone: string) => void;
  onDecline: () => void;
};

const formatAmount = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

// Who pays, shown before anything is charged: the saved number by default, or a different number
// for this payment only, with the number that will receive the M-Pesa request spelled out.
export const HomeCarePaymentActions = ({
  savedPhone,
  amountCents,
  currency = "KES",
  isPending,
  failed,
  resetKey,
  onConfirm,
  onDecline
}: HomeCarePaymentActionsProps) => {
  const savedUsable = hasUsableSavedNumber(savedPhone);
  const [mode, setMode] = useState<PayerMode>(savedUsable ? "saved" : "other");
  const [otherInput, setOtherInput] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState(false);
  const groupId = useId();
  const summaryId = `${groupId}-summary`;

  // A new booking starts from the saved number again; an unrelated re-render must not wipe what
  // the person has typed, so this depends on the booking, not on the booking object.
  useEffect(() => {
    setMode(hasUsableSavedNumber(savedPhone) ? "saved" : "other");
    setOtherInput("");
    setAttempted(false);
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const resolution = resolvePayer({ mode, savedPhone, otherInput });
  const savedDisplay = resolvePayer({ mode: "saved", savedPhone, otherInput: "" }).display;
  const showError = Boolean(resolution.error) && (attempted || (mode === "other" && touched && otherInput.length > 0));

  const confirm = () => {
    setAttempted(true);
    if (resolution.phone) {
      onConfirm(resolution.phone);
    }
  };

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2" disabled={isPending}>
        <legend className="pl-1 text-xs font-semibold text-slate-600">Pay with</legend>

        {savedUsable && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm has-[:checked]:border-tiba-blue has-[:checked]:bg-tiba-blue/5">
            <input
              type="radio"
              name={`${groupId}-payer`}
              className="h-4 w-4 text-tiba-blue focus:ring-tiba-blue"
              checked={mode === "saved"}
              onChange={() => setMode("saved")}
            />
            <span>
              <span className="block font-semibold text-slate-900">My saved number</span>
              <span className="block text-xs text-slate-500">{savedDisplay}</span>
            </span>
          </label>
        )}

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm has-[:checked]:border-tiba-blue has-[:checked]:bg-tiba-blue/5">
          <input
            type="radio"
            name={`${groupId}-payer`}
            className="h-4 w-4 text-tiba-blue focus:ring-tiba-blue"
            checked={mode === "other"}
            onChange={() => setMode("other")}
          />
          <span>
            <span className="block font-semibold text-slate-900">A different number</span>
            <span className="block text-xs text-slate-500">
              {savedUsable ? "Used for this payment only." : "Enter the Safaricom number to pay with."}
            </span>
          </span>
        </label>

        {mode === "other" && (
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            label="Number to charge"
            placeholder="e.g. 0712 345 678"
            value={otherInput}
            onChange={(event) => setOtherInput(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-describedby={summaryId}
            error={showError ? resolution.error ?? undefined : undefined}
          />
        )}
        {mode === "saved" && showError && (
          <p className="text-xs text-red-500" role="alert">
            {resolution.error}
          </p>
        )}
      </fieldset>

      <p id={summaryId} role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
        {resolution.phone ? (
          <>
            M-Pesa will ask <strong className="font-semibold">{resolution.display}</strong> to pay{" "}
            {formatAmount(amountCents, currency)}.
            {resolution.isAlternate && savedUsable && <> Your saved number, {savedDisplay}, is not changed.</>}
          </>
        ) : (
          "Choose a number to see who will be charged."
        )}
      </p>

      <div className="flex gap-2">
        <Button variant="secondary" className="h-12 flex-1 rounded-xl" onClick={onDecline} disabled={isPending}>
          Decline
        </Button>
        <Button className="h-12 flex-1 rounded-xl shadow-lg shadow-brand-100" onClick={confirm} loading={isPending}>
          {failed ? "Try again" : "Confirm & pay"}
        </Button>
      </div>
    </div>
  );
};
