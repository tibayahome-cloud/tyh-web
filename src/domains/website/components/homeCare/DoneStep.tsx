import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import { type HomeCareRequestResult } from "../../../../shared/libs/homeCarePublic";
import { bookingReference } from "../../../../shared/utils/bookingReference";
import { paidAfterLine } from "./format";

export const DoneStep = ({ result, serviceName, phone }: { result: HomeCareRequestResult; serviceName: string; phone: string }) => (
  <div className="space-y-4" role="status">
    <div className="flex items-center gap-3">
      <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden />
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Your visit is requested</h2>
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <p>
        <span className="font-semibold text-slate-900">{result.facility.name}</span> has your request for {serviceName}
        {result.scheduled_at ? ` on ${new Date(result.scheduled_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}` : ", as soon as possible"}.
      </p>
      <p className="mt-2">They will call {phone} to confirm. {paidAfterLine(result.price_cents, result.currency)}</p>
      <p className="mt-2">
        Your reference: <span className="font-mono font-semibold text-slate-900">{bookingReference(result.booking_id)}</span>
      </p>
    </div>
    <Link to="/" className="inline-flex min-h-[44px] items-center font-semibold text-tiba-blue underline underline-offset-2">
      Back to the home page
    </Link>
  </div>
);
