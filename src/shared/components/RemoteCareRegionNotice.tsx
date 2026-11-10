import { Button } from "./Button";

type RemoteCareRegionNoticeProps = {
  actionLabel: string;
  onAction: () => void;
};

// Shown instead of the booking steps when a client's country cannot be worked out from their phone number. People are
// never asked to pick a country: a Kenyan number means Kenya, which is the only place remote consultations run for now,
// so the one thing to do is to add a Kenyan number. Same amber banner shape as LocationPermissionBanner: explain, then
// a single action.
export const RemoteCareRegionNotice = ({ actionLabel, onAction }: RemoteCareRegionNoticeProps) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Remote consultations are available in Kenya for now</p>
        <p className="mt-1">
          We read your country from your phone number. If you are in Kenya, add a Kenyan number (starting +254) to your
          profile.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  </div>
);

export default RemoteCareRegionNotice;
