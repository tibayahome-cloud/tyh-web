import { Check } from "lucide-react";

import type { OnboardingSummary } from "../../utils/onboardingStatus";

type StepState = "done" | "current" | "attention" | "upcoming";

const STEPS = [
  { title: "Add your documents", detail: "Upload what we ask for." },
  { title: "Send for review", detail: "One tap once the required ones are in." },
  { title: "We check them", detail: "Our team looks at each document." },
  { title: "You are verified", detail: "Clients can book you." }
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

/** The pathway from "nothing uploaded" to "verified", so the provider can see where they are and what is next. */
export const OnboardingTimeline = ({ summary }: { summary: OnboardingSummary }) => {
  const states = timelineStates(summary);
  return (
    <section aria-label="Where you are" className="rounded-2xl border border-slate-200 bg-white p-5">
      <ol className="space-y-0">
        {STEPS.map((step, index) => {
          const state = states[index];
          const last = index === STEPS.length - 1;
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
    </section>
  );
};
