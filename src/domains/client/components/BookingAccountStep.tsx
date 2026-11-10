import { useState } from "react";

import { SignUpForm } from "../../../auth/SignUpForm";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { BookingSignInForm } from "./BookingSignInForm";

type BookingAccountStepProps = {
  /** Runs once the account exists (or the person has signed in) and the person is signed in. */
  onReady: () => void;
  /** Back to choosing a time. */
  onBack: () => void;
  /** True while the chosen time is being held after the account was made. */
  busy?: boolean;
};

/**
 * The booking's "Your details" step, for someone who is not signed in. It comes after the time is chosen, so a person
 * sees what is on offer, at what price and when, before they are asked who they are. Making the account here is the
 * same sign-up as on the sign-up page: name, phone, a password, and the two agreements. Someone who already has an
 * account signs in instead, without leaving the booking.
 */
export const BookingAccountStep = ({ onReady, onBack, busy = false }: BookingAccountStepProps) => {
  const [mode, setMode] = useState<"create" | "signin">("create");
  // Why the person was moved to signing in, when it was not their own choice: the account was made but signing in did not
  // work ("ready"), or the number or email they gave already has one ("exists", with what they typed so it carries over).
  const [handover, setHandover] = useState<{ reason: "ready" | "exists"; identifier: string } | null>(null);

  if (busy) {
    // Loading announces itself, and a minimum height keeps the dialog from collapsing for the moment before payment.
    return <Loading label="Holding your time" fullHeight />;
  }

  const creating = mode === "create";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{creating ? "Your details" : "Sign in to continue"}</h3>
        <p className="mt-1 text-sm text-slate-600">
          {creating
            ? "The last step before you pay. We use these to confirm your booking and to text you about your appointment."
            : "Sign in and we will carry on with the time you chose."}
        </p>
        {/* Up here, not under the form: someone who already has an account should not have to fill in a sign-up form, or
            scroll past it, to find the way to sign in. */}
        <button
          type="button"
          onClick={() => {
            setHandover(null);
            setMode(creating ? "signin" : "create");
          }}
          className="mt-1 inline-flex min-h-11 items-center rounded text-sm font-semibold text-tiba-blue underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
        >
          {creating ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>

      {handover?.reason === "ready" && (
        <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
          Your account is ready. Sign in to continue.
        </p>
      )}
      {handover?.reason === "exists" && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {handover.identifier.includes("@") ? "That email" : "That number"} already has an account. Sign in to carry on with
          your booking.
        </p>
      )}

      {creating ? (
        <SignUpForm
          submitLabel="Continue to payment"
          onSignedUp={onReady}
          onSignInNeeded={() => {
            setHandover({ reason: "ready", identifier: "" });
            setMode("signin");
          }}
          onAccountExists={(identifier) => {
            setHandover({ reason: "exists", identifier });
            setMode("signin");
          }}
        />
      ) : (
        <BookingSignInForm onSignedIn={onReady} defaultEmailOrPhone={handover?.identifier ?? ""} />
      )}

      <div className="flex justify-start">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
};

export default BookingAccountStep;
