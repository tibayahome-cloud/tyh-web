import { Clock, AlertTriangle, Hourglass } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { MpesaPaymentInstructions } from "../../../shared/components/MpesaPaymentInstructions";
import { usePaymentRequest } from "../../../shared/hooks/usePaymentRequest";

type Props = {
  bookingId: string;
  providerName: string | null;
  showManual: boolean;
  onToggleManual: () => void;
};

// "KES 2,500": the unit spelled out, the same on every device.
const money = (cents: number, currency: string) => `${currency} ${Math.round(cents / 100).toLocaleString("en-US")}`;

/**
 * What the client needs to know once their provider has finished a home visit: whether a payment request is on its
 * way, where to approve it, and what to do if it does not appear. The client never types a number here: the provider
 * sends the request, and paying is the confirmation.
 */
export const PaymentRequestNotice = ({ bookingId, providerName, showManual, onToggleManual }: Props) => {
  const query = usePaymentRequest(bookingId);
  const who = providerName ?? "Your provider";

  if (query.isPending) {
    return <div aria-busy="true" className="h-20 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />;
  }
  if (query.isError || !query.data) {
    return (
      <div role="alert" className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        <p>We could not check your payment request.</p>
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { state, amountCents, currency, payerPhoneMasked } = query.data;
  const amount = money(amountCents, currency);

  if (state === "none") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <Hourglass aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <p className="text-sm text-slate-800">
          {who} has finished the visit and will send you a payment request for {amount}. You do not need to do anything yet.
        </p>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-slate-900">The payment did not go through. {who} can send the request again.</p>
      </div>
    );
  }

  if (state === "exhausted") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-slate-900">The payment could not be completed. The facility will get in touch with you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-sky-50 p-4">
        <Clock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <p className="text-sm text-slate-900">
          {who} asked you to pay {amount}. Approve the M-Pesa prompt on {payerPhoneMasked ?? "your phone"}.
        </p>
      </div>
      <Button type="button" variant="ghost" className="min-h-[44px] w-full text-sm font-semibold text-slate-700" onClick={onToggleManual}>
        {showManual ? "Hide manual payment steps" : "Not seeing the prompt? Pay manually"}
      </Button>
      {showManual && (
        <MpesaPaymentInstructions amountCents={amountCents} accountNumber={bookingId.slice(0, 8).toUpperCase()} />
      )}
    </div>
  );
};
