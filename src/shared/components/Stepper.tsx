import classNames from "classnames";

type Step = {
  title: string;
  description?: string;
};

type StepperProps = {
  steps: Step[];
  current: number;
  // On a phone, show "Step 2 of 4: Facility" and a thin progress bar instead of the whole list, which otherwise takes
  // about 40% of the screen before any choice is visible. From the sm breakpoint up the full list shows as before.
  compactOnMobile?: boolean;
  // Titles only. For a page whose steps each say what to do in their own heading, the descriptions would repeat it, and in a
  // narrow column they wrap onto several lines.
  showDescriptions?: boolean;
};

export const Stepper = ({ steps, current, compactOnMobile = false, showDescriptions = true }: StepperProps) => {
  const position = Math.min(Math.max(current, 0), steps.length - 1);

  return (
    <>
      {compactOnMobile && steps.length > 0 && (
        <div className="sm:hidden" role="group" aria-label="Progress">
          <p className="text-sm font-semibold text-slate-900">
            Step {position + 1} of {steps.length}: {steps[position].title}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            <div className="h-full rounded-full bg-tiba-blue" style={{ width: `${((position + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      )}
      <ol className={classNames("flex-col gap-4 sm:flex sm:flex-row sm:items-start sm:gap-6", compactOnMobile ? "hidden" : "flex")}>
        {steps.map((step, index) => {
          const active = index === current;
          const completed = index < current;
          return (
            <li key={step.title} className="flex items-start gap-3">
              <span
                className={classNames(
                  "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  completed && "bg-emerald-500 text-white",
                  // The app's blue is `tiba-blue`; there is no `primary` colour, so the current step used to be white on white.
                  active && !completed && "bg-tiba-blue text-white",
                  !active && !completed && "bg-slate-200 text-slate-600"
                )}
              >
                {completed ? "✓" : index + 1}
              </span>
              <div>
                <p className={classNames("text-sm font-semibold", active ? "text-tiba-blue" : "text-slate-700")}>{step.title}</p>
                {showDescriptions && step.description && <p className="text-xs text-slate-500">{step.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
};

export default Stepper;
