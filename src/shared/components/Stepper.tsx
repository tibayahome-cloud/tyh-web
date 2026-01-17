import classNames from "classnames";

type Step = {
  title: string;
  description?: string;
};

type StepperProps = {
  steps: Step[];
  current: number;
};

export const Stepper = ({ steps, current }: StepperProps) => {
  return (
    <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      {steps.map((step, index) => {
        const active = index === current;
        const completed = index < current;
        return (
          <li key={step.title} className="flex items-start gap-3">
            <span
              className={classNames(
                "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                completed && "bg-emerald-500 text-white",
                active && !completed && "bg-primary-600 text-white",
                !active && !completed && "bg-slate-200 text-slate-600"
              )}
            >
              {completed ? "✓" : index + 1}
            </span>
            <div>
              <p className={classNames("text-sm font-semibold", active ? "text-primary-700" : "text-slate-700")}>{step.title}</p>
              {step.description && (
                <p className="text-xs text-slate-500">{step.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default Stepper;
