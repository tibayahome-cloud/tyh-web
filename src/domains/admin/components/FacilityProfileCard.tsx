import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import EditIcon from "@mui/icons-material/EditOutlined";
import SaveIcon from "@mui/icons-material/SaveOutlined";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { Input } from "../../../shared/components/Input";
import { updateFacility, updateFacilityStatus } from "../../../shared/libs/facilities";
import type { Facility } from "../../../shared/schemas/facility";
import {
  FACILITY_STATUSES,
  FACILITY_TYPES,
  HOSPITAL_LEVELS,
  buildFacilityProfileChanges,
  buildFacilityProfileForm,
  hasFacilityProfileChanges,
  mapFacilityProfileError,
  validateFacilityProfile,
  type FacilityProfileErrors,
  type FacilityProfileField,
  type FacilityProfileForm
} from "../../../shared/utils/facilityProfile";

const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20";

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type Props = {
  facility: Facility;
  // Opens the existing phone numbers and operating hours dialog.
  onEditContactAndHours: () => void;
  // Called after a successful save so the page can reload the persisted facility.
  onSaved: () => void;
};

const SelectField = ({
  label,
  error,
  children,
  ...rest
}: { label: string; error?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
    <span>{label}</span>
    <select className={SELECT_CLASS} aria-invalid={Boolean(error)} {...rest}>
      {children}
    </select>
    {error && <span className="text-xs text-red-500">{error}</span>}
  </label>
);

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-800">{value || "-"}</dd>
  </div>
);

// Super-admin-only editing of a facility's core record. The page decides who sees this; the API
// enforces it again. Core fields go to PATCH /facilities/{id}; status has its own endpoint.
export const FacilityProfileCard = ({ facility, onEditContactAndHours, onSaved }: Props) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FacilityProfileForm>(() => buildFacilityProfileForm(facility));
  const [errors, setErrors] = useState<FacilityProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { update, status } = buildFacilityProfileChanges(facility, form);
      if (Object.keys(update).length > 0) {
        await updateFacility(facility.id, update);
      }
      if (status) {
        try {
          await updateFacilityStatus(facility.id, status);
        } catch (error) {
          // The core fields above are already saved; say so rather than reporting a plain failure.
          throw Object.assign(new Error(mapFacilityProfileError(error).message), {
            partial: Object.keys(update).length > 0
          });
        }
      }
    },
    onSuccess: () => {
      setConfirming(false);
      setEditing(false);
      setErrors({});
      setFormError(null);
      setSaved(true);
      onSaved();
      requestAnimationFrame(() => editButtonRef.current?.focus());
    },
    onError: (error) => {
      setConfirming(false);
      if ((error as { partial?: boolean }).partial) {
        setErrors({});
        setFormError(
          `Your profile changes were saved, but the status change was not: ${(error as Error).message} Save again to retry the status.`
        );
        onSaved();
        return;
      }
      const { field, message } = mapFacilityProfileError(error);
      if (field) {
        setErrors({ [field]: message });
        setFormError(null);
      } else {
        setFormError(message);
      }
      // A core-field update may have gone through before a later step failed; reload what is saved.
      onSaved();
    }
  });

  const startEditing = () => {
    setForm(buildFacilityProfileForm(facility));
    setErrors({});
    setFormError(null);
    setSaved(false);
    setEditing(true);
  };

  const cancel = () => {
    if (saveMutation.isPending) return;
    setEditing(false);
    setErrors({});
    setFormError(null);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  const change = <K extends FacilityProfileField>(field: K, value: FacilityProfileForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const save = () => {
    const found = validateFacilityProfile(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    if (!hasFacilityProfileChanges(facility, form)) {
      setEditing(false);
      return;
    }
    // A fee or status change has commercial consequences, so it is confirmed first.
    const { update, status } = buildFacilityProfileChanges(facility, form);
    if (status || update.platformFeePercent !== undefined) {
      setConfirming(true);
      return;
    }
    saveMutation.mutate();
  };

  const { update: pendingUpdate, status: pendingStatus } = buildFacilityProfileChanges(facility, form);

  const badge = editing ? (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      Editing
    </span>
  ) : undefined;

  return (
    <Card
      title="Facility profile"
      subtitle="Identity, location, commercial terms and status. Only a super admin can change these."
      badge={badge}
    >
      {!editing ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" onClick={onEditContactAndHours}>
              Phone numbers and hours
            </Button>
            <Button ref={editButtonRef} variant="outline" size="sm" onClick={startEditing}>
              <EditIcon fontSize="small" aria-hidden="true" />
              Edit facility profile
            </Button>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Name" value={facility.name} />
            <Detail label="Type" value={titleCase(facility.facilityType)} />
            {facility.facilityType === "hospital" && (
              <Detail label="Hospital level" value={facility.hospitalLevel ? `Level ${facility.hospitalLevel}` : "Not set"} />
            )}
            <Detail label="Address" value={facility.address} />
            <Detail label="County" value={facility.county} />
            <Detail label="Country" value={facility.countryCode ?? "Not set"} />
            <Detail label="Email" value={facility.email} />
            <Detail label="Status" value={titleCase(facility.status)} />
            <Detail label="Platform fee" value={`${facility.platformFeePercent}% of each payment`} />
            <Detail label="Fast-response candidate" value={facility.fastResponseEnabled ? "Yes" : "No"} />
          </dl>
          {saved && (
            <p className="text-sm text-success-700" role="status">
              Facility profile saved.
            </p>
          )}
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          aria-label="Edit facility profile"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancel();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Facility name" name="facility-name" value={form.name} error={errors.name} onChange={(e) => change("name", e.target.value)} autoFocus />
            <SelectField label="Facility type" name="facility-type" value={form.facilityType} error={errors.facilityType} onChange={(e) => change("facilityType", e.target.value as FacilityProfileForm["facilityType"])}>
              {FACILITY_TYPES.map((type) => (
                <option key={type} value={type}>{titleCase(type)}</option>
              ))}
            </SelectField>
            {form.facilityType === "hospital" && (
              <SelectField label="Hospital level" name="facility-hospital-level" value={form.hospitalLevel} error={errors.hospitalLevel} onChange={(e) => change("hospitalLevel", e.target.value)}>
                <option value="">Choose a level</option>
                {HOSPITAL_LEVELS.map((level) => (
                  <option key={level} value={String(level)}>Level {level}</option>
                ))}
              </SelectField>
            )}
            <Input label="Address" name="facility-address" value={form.address} error={errors.address} onChange={(e) => change("address", e.target.value)} />
            <Input label="County" name="facility-county" value={form.county} error={errors.county} onChange={(e) => change("county", e.target.value)} />
            <Input label="Country code" name="facility-country" value={form.countryCode} error={errors.countryCode} hint="Two letters, for example KE." maxLength={2} onChange={(e) => change("countryCode", e.target.value.toUpperCase())} />
            <Input label="Facility email" name="facility-email" type="email" value={form.email} error={errors.email} onChange={(e) => change("email", e.target.value)} />
            <SelectField label="Status" name="facility-status" value={form.status} error={errors.status} onChange={(e) => change("status", e.target.value as FacilityProfileForm["status"])}>
              {FACILITY_STATUSES.map((status) => (
                <option key={status} value={status}>{titleCase(status)}</option>
              ))}
            </SelectField>
            <Input
              label="Platform fee (%)"
              name="facility-platform-fee"
              inputMode="decimal"
              value={form.platformFeePercent}
              error={errors.platformFeePercent}
              hint="Percentage of each payment kept by TYH, from 0 to 100. Settlement uses the fee in force when it runs, so a change can also affect payments already made but not yet settled."
              onChange={(e) => change("platformFeePercent", e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={form.fastResponseEnabled} onChange={(e) => change("fastResponseEnabled", e.target.checked)} />
            <span>
              <span className="font-medium">Fast-response candidate</span>
              <span className="block text-xs text-slate-500">Internal only. Clients never see this.</span>
            </span>
          </label>
          {form.status !== facility.status && (
            <p className="text-xs text-slate-600">
              Status will change from {titleCase(facility.status)} to {titleCase(form.status)}. This affects whether clients can book this facility.
            </p>
          )}
          {formError && (
            <p className="text-sm text-danger-600" role="alert">
              {formError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={cancel} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              <SaveIcon fontSize="small" aria-hidden="true" />
              {saveMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={confirming}
        title="Confirm these changes?"
        description={
          [
            pendingUpdate.platformFeePercent !== undefined
              ? `Platform fee changes from ${facility.platformFeePercent}% to ${pendingUpdate.platformFeePercent}%. Settlement uses the fee in force when it runs, so this can also affect payments already made but not yet settled.`
              : null,
            pendingStatus
              ? `Status changes from ${titleCase(facility.status)} to ${titleCase(pendingStatus)}. This can change whether clients can find and book this facility.`
              : null
          ]
            .filter(Boolean)
            .join(" ")
        }
        confirmLabel="Save changes"
        loading={saveMutation.isPending}
        onConfirm={() => saveMutation.mutate()}
        onClose={() => {
          if (!saveMutation.isPending) setConfirming(false);
        }}
      />
    </Card>
  );
};
