import { Button } from "./Button";

type CountryRequiredBannerProps = {
  onComplete: () => void;
  description?: string;
};

// Shown wherever a country is required before a workflow can proceed (currently telemedicine
// booking/eligibility) but the caller's profile doesn't have one set yet. Mirrors
// LocationPermissionBanner's shape: same visual language, same "explain + single action" pattern.
export const CountryRequiredBanner = ({ onComplete, description }: CountryRequiredBannerProps) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Country required</p>
        <p className="text-xs">
          {description ?? "Add your country to your profile to continue -- remote consultations are only available where we currently operate."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onComplete}>
          Complete profile
        </Button>
      </div>
    </div>
  </div>
);

export default CountryRequiredBanner;
