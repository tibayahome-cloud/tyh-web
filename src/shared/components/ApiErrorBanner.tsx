import { AlertCircle, AlertTriangle, Clock, Lock, SearchX, ShieldAlert, WifiOff } from "lucide-react";

import { Button } from "./Button";
import type { ApiErrorCategory } from "../utils/errors";

type ApiErrorBannerProps = {
  category: ApiErrorCategory;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

const CATEGORY_PRESENTATION: Record<
  ApiErrorCategory,
  { title: string; icon: typeof AlertCircle; tone: "danger" | "amber" }
> = {
  unauthorized: { title: "Sign in required", icon: Lock, tone: "danger" },
  forbidden: { title: "Not allowed", icon: ShieldAlert, tone: "danger" },
  not_found: { title: "No longer available", icon: SearchX, tone: "danger" },
  bad_request: { title: "Can't continue", icon: AlertCircle, tone: "danger" },
  timeout: { title: "Taking too long", icon: Clock, tone: "amber" },
  unavailable: { title: "Temporarily unavailable", icon: WifiOff, tone: "amber" },
  unknown: { title: "Something went wrong", icon: AlertTriangle, tone: "danger" }
};

// danger only defines 50/100/500/600 in tailwind.config.js -- 200/800 would silently emit no
// class at build time, so this sticks to the shades the theme actually has.
const TONE_CLASSES = {
  danger: "border-danger-100 bg-danger-50 text-danger-600",
  amber: "border-amber-200 bg-amber-50 text-amber-800"
} as const;

// Presents a classifyApiError() result with consistent copy and color across telemedicine
// screens. The title communicates the category; `message` is always the backend's own text
// (or a network-level fallback), never a client-invented explanation.
export const ApiErrorBanner = ({ category, message, onRetry, retryLabel = "Try again" }: ApiErrorBannerProps) => {
  const { title, icon: Icon, tone } = CATEGORY_PRESENTATION[category];

  return (
    <div role="alert" className={`rounded-2xl border px-4 py-3 text-sm ${TONE_CLASSES[tone]}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs">{message}</p>
          </div>
        </div>
        {onRetry && (
          <div className="flex flex-wrap gap-2 pl-6 sm:pl-0">
            <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiErrorBanner;
