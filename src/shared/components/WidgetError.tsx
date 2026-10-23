import { AlertCircle } from "lucide-react";

import { Button } from "./Button";

type WidgetErrorProps = {
  // What could not be loaded, in the person's words: "your earnings", "your upcoming appointments".
  what: string;
  onRetry?: () => void;
  className?: string;
};

// A failed request for one part of a page. It says what is missing and offers a retry, so a failure never
// reads as "nothing here" or, worse, as a value (KES 0.00, a rating of 0.0). One of these failing leaves the
// rest of the page alone.
export const WidgetError = ({ what, onRetry, className = "" }: WidgetErrorProps) => (
  <div
    role="alert"
    className={`flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
  >
    <span className="flex items-center gap-2">
      <AlertCircle size={16} className="shrink-0" aria-hidden />
      We could not load {what}.
    </span>
    {onRetry && (
      <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export default WidgetError;
