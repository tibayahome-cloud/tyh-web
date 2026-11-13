import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { Button } from "../../../../shared/components/Button";
import { Input } from "../../../../shared/components/Input";
import { Skeleton } from "../../../../shared/components/Skeleton";
import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY } from "../../../../shared/constants/contact";
import { useDeviceLocation } from "../../../../shared/hooks/useDeviceLocation";
import { fetchHomeCareCoverage, type HomeCareClinic, type HomeCareService } from "../../../../shared/libs/homeCarePublic";
import { classifyApiError } from "../../../../shared/utils/errors";
import { CURRENT_PLACE, describePlace, UNNAMED_PLACE, type Place } from "../../../../shared/utils/geocoding";
import { formatKm, paidAfterLine } from "./format";
import { PinPicker } from "./PinPicker";
import { StepHeading } from "./ServiceStep";

export type VisitPlace = { place: Place | null; landmark: string };

type PlaceStepProps = {
  service: HomeCareService;
  value: VisitPlace;
  onChange: (value: VisitPlace) => void;
  onContinue: (clinics: HomeCareClinic[]) => void;
};

/** A place with no real name ("Pinned location") cannot guide a carer on its own: a landmark is then needed. */
const isUnnamed = (place: Place | null) => !place || place.name === UNNAMED_PLACE || place.name === CURRENT_PLACE;

export const PlaceStep = ({ service, value, onChange, onContinue }: PlaceStepProps) => {
  const device = useDeviceLocation(value.place === null);
  const latest = useRef(value);
  latest.current = value;

  // Every new reading from the device (the first one on arrival, and each press of "Use my current location") becomes the
  // place, named in full. The person then moves the map from there.
  const applied = useRef<unknown>(null);
  useEffect(() => {
    if (device.status !== "found" || !device.coords || applied.current === device.coords) return;
    applied.current = device.coords;
    const coords = device.coords;
    let cancelled = false;
    void describePlace(coords).then((described) => {
      if (cancelled) return;
      onChange({ ...latest.current, place: { name: described?.address ?? CURRENT_PLACE, coords, plusCode: described?.plusCode ?? null } });
    });
    return () => {
      cancelled = true;
    };
  }, [device.status, device.coords, onChange]);

  const coords = value.place?.coords ?? null;
  const coverage = useQuery({
    queryKey: ["public", "home-care", "coverage", service.id, coords ? coords.lat.toFixed(3) : null, coords ? coords.lng.toFixed(3) : null],
    queryFn: ({ signal }) => fetchHomeCareCoverage(service.id, coords as { lat: number; lng: number }, signal),
    enabled: coords !== null,
    staleTime: 30_000
  });

  const clinics = coverage.data?.facilities ?? [];
  const nearest = clinics[0];
  const covered = Boolean(coverage.data?.covered && nearest);
  const needsLandmark = isUnnamed(value.place) && value.landmark.trim().length < 3;
  const locating = device.status === "asking" && value.place === null;

  return (
    <div className="space-y-4">
      <StepHeading hint="We read your location, like a ride app. Move the map until the pin is on your gate.">Where should we come?</StepHeading>

      {locating && (
        <p role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Finding your location. If your browser asks, choose Allow.
        </p>
      )}

      {value.place === null && !locating && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {device.status === "denied"
            ? "Your browser did not share your location. Allow it for this site, or search for your address below."
            : "We could not read your location. Search for your address below."}
        </p>
      )}

      <PinPicker
        value={value.place}
        onChange={(place) => onChange({ ...latest.current, place })}
        device={{ coords: device.coords, accuracyM: device.accuracyM, locating: device.status === "asking", ask: device.ask }}
      />

      {value.place && (
        <Input
          label={isUnnamed(value.place) ? "Street, gate or landmark" : "Gate, floor or landmark (optional)"}
          name="landmark"
          value={value.landmark}
          maxLength={200}
          placeholder="Blue gate, second floor, near the school"
          error={needsLandmark ? "Tell us the street or a landmark so the carer can find you." : undefined}
          onChange={(event) => onChange({ ...value, landmark: event.target.value })}
        />
      )}

      {coords && coverage.isFetching && !coverage.data && (
        <div role="status" aria-live="polite">
          <span className="sr-only">Checking which clinics can reach you</span>
          <Skeleton height={72} />
        </div>
      )}

      {coverage.isError && (
        <ApiErrorBanner {...classifyApiError(coverage.error, "We could not check your area.")} onRetry={() => void coverage.refetch()} />
      )}

      {covered && nearest && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">We can reach you.</p>
          <p className="mt-1">
            {nearest.name} is {formatKm(nearest.distance_km)} away and will visit. {paidAfterLine(nearest.price_cents, nearest.currency)}
          </p>
          {clinics.length > 1 && <p className="mt-1">{clinics.length - 1} more nearby also reach you. Your request goes to the nearest.</p>}
        </div>
      )}

      {coverage.data && !covered && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">No clinic visits this place yet.</p>
          <p className="mt-1">
            Change the place if it is wrong, or call us on{" "}
            <a className="font-semibold underline underline-offset-2" href={`tel:${COMPANY_PHONE}`}>
              {COMPANY_PHONE_DISPLAY}
            </a>{" "}
            and we will see what we can arrange.
          </p>
        </div>
      )}

      <Button type="button" size="lg" fullWidth disabled={!covered || needsLandmark} onClick={() => onContinue(clinics)}>
        Yes, come here
      </Button>
    </div>
  );
};
