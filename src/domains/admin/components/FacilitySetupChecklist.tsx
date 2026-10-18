import { Card } from "../../../shared/components/Card";
import type { ChecklistStep } from "../../../shared/utils/telemedicineReadiness";

type Props = {
  steps: ChecklistStep[];
  firstMissing: ChecklistStep | null;
  // Opens the workspace tab where a missing step is fixed.
  onOpenTab: (tab: "services" | "providers") => void;
};

const TAB_FOR_STEP: Record<string, "services" | "providers" | undefined> = {
  services: "services",
  providers: "providers",
  ready: "providers",
  coverage: "providers"
};

// Whether clients can book this facility for telemedicine, as a list of steps, with the first
// missing one called out and a button to the screen that fixes it. It reads data the page already
// has; the server still decides what clients see.
export const FacilitySetupChecklist = ({ steps, firstMissing, onOpenTab }: Props) => {
  const done = steps.filter((step) => step.done).length;
  const complete = firstMissing === null;
  return (
    <Card
      title="Telemedicine setup"
      subtitle={
        complete
          ? "Every step is done. Clients can find this facility for the telemedicine services it offers."
          : "Clients cannot book telemedicine here until every step is done."
      }
      badge={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${complete ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}
        >
          {complete ? "Ready" : `${done} of ${steps.length} done`}
        </span>
      }
    >
      <ol className="space-y-2" aria-label="Telemedicine setup steps">
        {steps.map((step) => {
          const isFirst = firstMissing?.key === step.key;
          const tab = TAB_FOR_STEP[step.key];
          return (
            <li
              key={step.key}
              className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${isFirst ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  <span className="mr-2" aria-hidden="true">
                    {step.done ? "✓" : "○"}
                  </span>
                  {step.title}
                  <span className="sr-only">{step.done ? ", done" : isFirst ? ", next step" : ", not done"}</span>
                </p>
                {step.blocker && (
                  <p className="mt-0.5 text-xs text-slate-700">
                    <span className="font-medium">{step.blocker.label}.</span> {step.blocker.fix}
                  </p>
                )}
              </div>
              {step.blocker && isFirst && tab && (
                <button
                  type="button"
                  className="self-start rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:self-auto"
                  onClick={() => onOpenTab(tab)}
                >
                  {tab === "services" ? "Go to Services" : "Go to Providers"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
};
