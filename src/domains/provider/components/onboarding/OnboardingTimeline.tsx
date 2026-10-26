import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { OnboardingSummary } from "../../utils/onboardingStatus";

type StepState = "done" | "current" | "attention" | "upcoming";

const stepsFor = (alreadyVerified: boolean) => [
  { title: "Add your documents", detail: "Upload what we ask for." },
  { title: "Send for review", detail: "Once the required ones are in, you check them and send." },
  { title: "We check them", detail: "Our team looks at each document." },
  alreadyVerified
    ? { title: "Your documents are confirmed", detail: "You keep taking bookings the whole time." }
    : { title: "You are verified", detail: "Clients can book you." }
];

/** Which step the provider is on, from the server's one status. Steps before it are done. */
export const timelineStates = (summary: OnboardingSummary): StepState[] => {
  switch (summary.status) {
    case "not_started":
      return ["current", "upcoming", "upcoming", "upcoming"];
    case "documents_needed":
      return summary.readyToSubmit ? ["done", "current", "upcoming", "upcoming"] : ["current", "upcoming", "upcoming", "upcoming"];
    case "in_review":
      return ["done", "done", "current", "upcoming"];
    case "needs_changes":
      return ["attention", "upcoming", "upcoming", "upcoming"];
    case "verified":
    case "set_up_by_facility":
      return ["done", "done", "done", "done"];
  }
};

const DOT: Record<StepState, string> = {
  done: "border-emerald-600 bg-emerald-500 text-white",
  current: "border-tiba-blue bg-white ring-4 ring-sky-100",
  attention: "border-amber-500 bg-white ring-4 ring-amber-100",
  upcoming: "border-slate-300 bg-white"
};

type Props = { summary: OnboardingSummary; defaultOpen?: boolean };

/**
 * The pathway from "nothing uploaded" to "verified". Folded by default while there is work to do, since the checklist is
 * what matters then; open while the application is with a reviewer or has been sent back, when the pathway is the answer.
 */
export const OnboardingTimeline = ({ summary, defaultOpen = false }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const states = timelineStates(summary);
  const steps = stepsFor(summary.providerVerified && summary.status !== "verified" && summary.status !== "set_up_by_facility");
  const here = steps[Math.max(0, states.findIndex((state) => state === "current" || state === "attention"))];
  return (
    <section aria-label="Where you are" className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="process-steps"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl px-5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
      >
        <span>
          <span className="block text-base font-semibold text-slate-900">How the process works</span>
          <span className="block text-sm text-slate-700">You are at: {here.title}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-tiba-blue transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol id="process-steps" className="space-y-0 px-5 pb-5">
          {steps.map((step, index) => {
            const state = states[index];
            const last = index === steps.length - 1;
            return (
              <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0" aria-current={state === "current" || state === "attention" ? "step" : undefined}>
                {!last && (
                  <span aria-hidden="true" className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 ${state === "done" ? "bg-emerald-500" : "bg-slate-200"}`} />
                )}
                <span aria-hidden="true" className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${DOT[state]}`}>
                  {state === "done" && <Check className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className={`text-base ${state === "upcoming" ? "text-slate-600" : "font-semibold text-slate-900"}`}>
                    {step.title}
                    <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (you are here)" : state === "attention" ? " (needs your attention)" : ""}</span>
                  </p>
                  <p className="text-sm text-slate-700">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
