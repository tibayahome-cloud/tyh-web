import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Smartphone, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { COMPANY_PHONE, COMPANY_PHONE_LOCAL } from "../../../../shared/constants/contact";
import {
  fetchAmbulancePayment,
  resendAmbulancePayment,
  type AmbulancePayment,
  type HomeCareRequestResult
} from "../../../../shared/libs/homeCarePublic";
import { getApiError } from "../../../../shared/utils/errors";
import { formatMoney } from "./format";

const STILL_GOING: AmbulancePayment["state"][] = ["none", "sending", "waiting"];

/**
 * An ambulance is paid for before it is sent. After the request, the M-Pesa prompt is on the visitor's phone: this step
 * follows it until it is paid (then the request goes to the facility and onPaid shows the confirmation), failed (send it
 * again), or not paid within the hour (start again).
 */
export const PayStep = ({
  result,
  phone,
  onPaid
}: {
  result: HomeCareRequestResult;
  phone: string;
  onPaid: () => void;
}) => {
  const query = useQuery({
    queryKey: ["public", "home-care", "payment", result.booking_id],
    queryFn: () => fetchAmbulancePayment(result.booking_id),
    initialData: result.payment ?? undefined,
    // Follow the prompt while it is out; stop once there is an answer.
    refetchInterval: (q) => (STILL_GOING.includes(q.state.data?.state ?? "none") ? 3000 : false)
  });
  const resend = useMutation({
    mutationFn: () => resendAmbulancePayment(result.booking_id, phone),
    onSuccess: () => void query.refetch()
  });

  const payment = query.data;
  useEffect(() => {
    if (payment?.state === "paid") onPaid();
  }, [payment?.state, onPaid]);
  const amount = formatMoney(payment?.amount_cents ?? result.price_cents, payment?.currency ?? result.currency);
  const state = payment?.state ?? "none";
  const payBy = payment ? new Date(payment.pay_by).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" }) : null;

  if (state === "expired") {
    return (
      <div className="space-y-4" role="status">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">This request was not paid in time</h2>
        <p className="text-sm text-slate-700">No ambulance was sent and nothing was charged. Make a new request, or call us on {COMPANY_PHONE_LOCAL}.</p>
        <Link to="/book/home-care?care=ambulance" reloadDocument className="inline-flex min-h-[44px] items-center font-semibold text-tiba-blue underline underline-offset-2">
          Make a new request
        </Link>
      </div>
    );
  }

  const failed = state === "failed" || state === "exhausted";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        {failed ? (
          <XCircle className="h-8 w-8 shrink-0 text-amber-600" aria-hidden />
        ) : (
          <Smartphone className="h-8 w-8 shrink-0 text-tiba-blue" aria-hidden />
        )}
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{failed ? "The payment did not go through" : `Pay ${amount} to send the ambulance`}</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        {failed ? (
          <p>Nothing was charged. Send the M-Pesa prompt again and enter your PIN.</p>
        ) : (
          <>
            <p>
              Check your phone{payment?.payer_phone_masked ? ` (${payment.payer_phone_masked})` : ""} and enter your M-Pesa PIN to pay{" "}
              <span className="font-semibold text-slate-900">{amount}</span>.
            </p>
            <p className="mt-2 flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Waiting for M-Pesa to confirm…
            </p>
          </>
        )}
        <p className="mt-2">
          <span className="font-semibold text-slate-900">{result.facility.name}</span> sends the ambulance once you have paid.
          {payBy ? ` Pay by ${payBy}, or the request lapses.` : ""}
        </p>
      </div>

      {state !== "exhausted" && (
        <Button
          type="button"
          size="lg"
          fullWidth
          variant={failed ? "primary" : "outline"}
          loading={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {failed ? "Send the prompt again" : "I did not get the prompt"}
        </Button>
      )}
      {resend.isError && <p className="text-sm text-amber-800">{getApiError(resend.error)}</p>}
      {state === "exhausted" && (
        <p className="text-sm text-slate-700">
          The prompt has been sent too many times. Call us on{" "}
          <a className="font-semibold underline underline-offset-2" href={`tel:${COMPANY_PHONE}`}>
            {COMPANY_PHONE_LOCAL}
          </a>{" "}
          to finish your request.
        </p>
      )}
    </div>
  );
};
