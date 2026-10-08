import { isAxiosError } from "axios";

import {
  FACILITY_STATUSES,
  FACILITY_TYPES,
  HOSPITAL_LEVELS,
  type Facility,
  type FacilityStatus,
  type FacilityType,
  type FacilityUpdateInput
} from "../schemas/facility";
import { getApiError } from "./errors";

export { FACILITY_STATUSES, FACILITY_TYPES, HOSPITAL_LEVELS };

// What a super admin edits in the facility profile. Phones and operating hours have their own
// dialog; identity (id), historical ownership and audit metadata are never part of this form.
export type FacilityProfileForm = {
  name: string;
  facilityType: FacilityType;
  hospitalLevel: string;
  address: string;
  county: string;
  countryCode: string;
  email: string;
  status: FacilityStatus;
  platformFeePercent: string;
  fastResponseEnabled: boolean;
};

export type FacilityProfileField = keyof FacilityProfileForm;
export type FacilityProfileErrors = Partial<Record<FacilityProfileField, string>>;

export const buildFacilityProfileForm = (facility: Facility): FacilityProfileForm => ({
  name: facility.name,
  facilityType: facility.facilityType,
  hospitalLevel: facility.hospitalLevel === null ? "" : String(facility.hospitalLevel),
  address: facility.address,
  county: facility.county,
  countryCode: facility.countryCode ?? "",
  email: facility.email,
  status: facility.status,
  platformFeePercent: String(facility.platformFeePercent),
  fastResponseEnabled: facility.fastResponseEnabled
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Percent with at most two decimals, matching the API's NUMERIC(5,2) column.
export const parsePlatformFee = (raw: string): number | null => {
  const value = raw.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 0 && parsed <= 100 ? parsed : null;
};

export const validateFacilityProfile = (form: FacilityProfileForm): FacilityProfileErrors => {
  const errors: FacilityProfileErrors = {};
  if (!form.name.trim()) errors.name = "Enter the facility name.";
  if (!form.address.trim()) errors.address = "Enter the street address.";
  if (!form.county.trim()) errors.county = "Enter the county.";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (form.countryCode.trim() && !/^[A-Za-z]{2}$/.test(form.countryCode.trim())) {
    errors.countryCode = "Use a two-letter country code, for example KE.";
  }
  if (form.facilityType === "hospital") {
    if (!HOSPITAL_LEVELS.some((level) => String(level) === form.hospitalLevel)) {
      errors.hospitalLevel = "Choose a hospital level from 1 to 6.";
    }
  }
  if (!form.platformFeePercent.trim()) {
    errors.platformFeePercent = "Enter the platform fee as a percentage from 0 to 100.";
  } else if (parsePlatformFee(form.platformFeePercent) === null) {
    errors.platformFeePercent = "The platform fee must be a percentage from 0 to 100, with up to two decimals.";
  }
  return errors;
};

// Only what changed, in the shape PATCH /facilities/{id} accepts. Status is not a core field:
// the API takes it on PATCH /facilities/{id}/status, so it is returned separately.
export const buildFacilityProfileChanges = (
  facility: Facility,
  form: FacilityProfileForm
): { update: FacilityUpdateInput; status: FacilityStatus | null } => {
  const update: FacilityUpdateInput = {};
  if (form.name.trim() !== facility.name) update.name = form.name.trim();
  if (form.facilityType !== facility.facilityType) update.facilityType = form.facilityType;
  const level = form.facilityType === "hospital" ? Number(form.hospitalLevel) : null;
  // The API validates type and level together, so send the level whenever either changes.
  if (level !== facility.hospitalLevel || form.facilityType !== facility.facilityType) update.hospitalLevel = level;
  if (form.address.trim() !== facility.address) update.address = form.address.trim();
  if (form.county.trim() !== facility.county) update.county = form.county.trim();
  const country = form.countryCode.trim().toUpperCase();
  if (country !== (facility.countryCode ?? "")) update.countryCode = country || null;
  if (form.email.trim().toLowerCase() !== facility.email.toLowerCase()) update.email = form.email.trim();
  const fee = parsePlatformFee(form.platformFeePercent);
  if (fee !== null && fee !== facility.platformFeePercent) update.platformFeePercent = fee;
  if (form.fastResponseEnabled !== facility.fastResponseEnabled) update.fastResponseEnabled = form.fastResponseEnabled;
  return { update, status: form.status !== facility.status ? form.status : null };
};

export const hasFacilityProfileChanges = (facility: Facility, form: FacilityProfileForm): boolean => {
  const { update, status } = buildFacilityProfileChanges(facility, form);
  return Object.keys(update).length > 0 || status !== null;
};

const FIELD_HINTS: Array<[RegExp, FacilityProfileField]> = [
  [/platform_fee|platform fee/i, "platformFeePercent"],
  [/hospital_level|hospital level/i, "hospitalLevel"],
  [/facility_type|facility type/i, "facilityType"],
  [/country/i, "countryCode"],
  [/email/i, "email"],
  [/address/i, "address"],
  [/county/i, "county"],
  [/\bname\b/i, "name"],
  [/fast_response|fast response/i, "fastResponseEnabled"],
  [/status/i, "status"]
];

// The API reports a rejected field as one message string. When the message names the field,
// show it beside that field; otherwise it stays a form-level message. Nothing is hidden: the
// original server text is always shown.
export const mapFacilityProfileError = (
  error: unknown
): { field: FacilityProfileField | null; message: string } => {
  if (isAxiosError(error) && error.response?.status === 403) {
    return { field: null, message: "Only a super admin can edit the facility profile." };
  }
  const message = getApiError(error, "We could not save the facility. Try again.");
  const hint = FIELD_HINTS.find(([pattern]) => pattern.test(message));
  return { field: hint ? hint[1] : null, message };
};
