import { Button } from "./Button";
import type { LocationPermissionStatus } from "../hooks/useLocationAccess";

type LocationPermissionBannerProps = {
  status: LocationPermissionStatus;
  error?: string | null;
  onRetry: () => void;
  headline?: string;
  description?: string;
};

const statusCopy: Record<LocationPermissionStatus, { title: string; body: string }> = {
  checking: {
    title: "Checking location access…",
    body: "Hang tight while we verify your device location settings."
  },
  granted: {
    title: "Location enabled",
    body: "You're good to go."
  },
  prompt: {
    title: "Turn on location services",
    body: "We need your current location to match you with the right bookings."
  },
  denied: {
    title: "Location permission required",
    body: "Enable location in your browser/device settings to continue."
  }
};

export const LocationPermissionBanner = ({
  status,
  error,
  onRetry,
  headline,
  description
}: LocationPermissionBannerProps) => {
  if (status === "granted") {
    return null;
  }

  const copy = statusCopy[status];
  const title = headline ?? copy.title;
  const body = description ?? copy.body;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs">{body}</p>
          {error && (
            <p className="mt-1 text-xs text-amber-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onRetry}>
            Enable location
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionBanner;
