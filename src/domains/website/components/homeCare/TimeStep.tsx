import { useState } from "react";

import { Button } from "../../../../shared/components/Button";
import { localInputValue } from "./format";
import { StepHeading } from "./ServiceStep";

export type VisitTime = { mode: "asap" } | { mode: "later"; at: string };

export const TimeStep = ({ value, onContinue }: { value: VisitTime; onContinue: (time: VisitTime) => void }) => {
  const [mode, setMode] = useState<VisitTime["mode"]>(value.mode);
  const [at, setAt] = useState(value.mode === "later" ? value.at : "");
  // Far enough ahead that a clinic can plan the visit.
  const earliest = localInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const laterOk = at !== "" && at >= earliest;

  const option = (key: VisitTime["mode"], title: string, hint: string) => (
    <label
      className={`flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-tiba-blue/40 ${
        mode === key ? "border-tiba-blue" : "border-slate-200"
      }`}
    >
      <input type="radio" name="visit-time" className="mt-1 h-5 w-5" checked={mode === key} onChange={() => setMode(key)} />
      <span>
        <span className="block text-base font-semibold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-600">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-4">
      <StepHeading>When should we come?</StepHeading>
      <fieldset className="space-y-3">
        <legend className="sr-only">When should we come?</legend>
        {option("asap", "As soon as possible", "The nearest clinic is asked to come as soon as it can.")}
        {option("later", "On a day and time I choose", "Pick a time at least 2 hours from now.")}
      </fieldset>

      {mode === "later" && (
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700" htmlFor="visit-at">
          Day and time
          <input
            id="visit-at"
            type="datetime-local"
            min={earliest}
            value={at}
            onChange={(event) => setAt(event.target.value)}
            aria-invalid={at !== "" && !laterOk}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
          />
          {at !== "" && !laterOk && <span className="text-sm text-danger-600">Choose a time at least 2 hours from now.</span>}
        </label>
      )}

      <Button
        type="button"
        size="lg"
        fullWidth
        disabled={mode === "later" && !laterOk}
        onClick={() => onContinue(mode === "asap" ? { mode: "asap" } : { mode: "later", at })}
      >
        Continue
      </Button>
    </div>
  );
};
