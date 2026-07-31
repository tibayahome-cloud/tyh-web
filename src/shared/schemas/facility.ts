import { z } from "zod";

import { coerceBoolean, coerceDate, coerceId, coerceNumber, coerceString, toObject } from "./helpers";

export const FACILITY_TYPES = ["hospital", "clinic", "agency", "other"] as const;
export const FACILITY_STATUSES = ["pending", "active", "suspended"] as const;
export const PROVIDER_COMPENSATION_MODES = ["employee", "fixed", "percentage"] as const;
export const BOOKING_REQUEST_MODES = ["selected_facility", "fastest_available"] as const;
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type FacilityType = (typeof FACILITY_TYPES)[number];
export type FacilityStatus = (typeof FACILITY_STATUSES)[number];
export type ProviderCompensationMode = (typeof PROVIDER_COMPENSATION_MODES)[number];
export type BookingRequestMode = (typeof BOOKING_REQUEST_MODES)[number];
export type FacilityWeekday = (typeof WEEKDAYS)[number];

export const FacilityPhoneSchema = z.object({
  id: z.string(),
  phone: z.string(),
  label: z.string().nullable(),
  isPrimary: z.boolean()
});

export type FacilityPhone = z.infer<typeof FacilityPhoneSchema>;

export const FacilityOperatingHourSchema = z.object({
  id: z.string(),
  weekday: z.enum(WEEKDAYS),
  openTime: z.string().nullable(),
  closeTime: z.string().nullable(),
  isClosed: z.boolean(),
  is24Hours: z.boolean()
});

export type FacilityOperatingHour = z.infer<typeof FacilityOperatingHourSchema>;

export const FacilityServiceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string().nullable(),
  basePriceCents: z.number().nullable(),
  defaultEstimateMinutes: z.number().nullable()
});

export type FacilityServiceSummary = z.infer<typeof FacilityServiceSummarySchema>;

export const FacilityServiceSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  serviceId: z.string(),
  priceCents: z.number(),
  currency: z.string(),
  estimateDurationMinutes: z.number().nullable(),
  active: z.boolean(),
  isEmergencyCapable: z.boolean(),
  service: FacilityServiceSummarySchema.nullable()
});

export type FacilityService = z.infer<typeof FacilityServiceSchema>;

export const FacilityAdminSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  userId: z.string(),
  roleKey: z.string(),
  active: z.boolean()
});

export type FacilityAdmin = z.infer<typeof FacilityAdminSchema>;

export const FacilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  facilityType: z.enum(FACILITY_TYPES),
  address: z.string(),
  county: z.string(),
  email: z.string(),
  status: z.enum(FACILITY_STATUSES),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  platformFeePercent: z.number(),
  providerFinancialsVisible: z.boolean(),
  approvedAt: z.string().nullable(),
  suspendedAt: z.string().nullable(),
  phones: z.array(FacilityPhoneSchema),
  operatingHours: z.array(FacilityOperatingHourSchema),
  services: z.array(FacilityServiceSchema),
  admins: z.array(FacilityAdminSchema)
});

export type Facility = z.infer<typeof FacilitySchema>;

export const FacilityDiscoveryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  facilityType: z.enum(FACILITY_TYPES),
  address: z.string(),
  county: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  distanceM: z.number().nullable(),
  operatingStatus: z.string().nullable(),
  availabilitySignal: z.string().nullable(),
  service: FacilityServiceSchema
});

export type FacilityDiscoveryItem = z.infer<typeof FacilityDiscoveryItemSchema>;

export const FacilityDiscoveryResultSchema = z.object({
  radiusM: z.number().nullable(),
  nextRadiusM: z.number().nullable(),
  facilities: z.array(FacilityDiscoveryItemSchema)
});

export type FacilityDiscoveryResult = z.infer<typeof FacilityDiscoveryResultSchema>;

export type ProviderCompensation = {
  mode: ProviderCompensationMode;
  fixedPayoutCents: number | null;
  payoutPercentage: number | null;
};

const toResourceRecord = (payload: unknown): Record<string, unknown> => {
  const base = toObject(payload);
  const attributes = toObject(base.attributes);
  return { ...base, ...attributes };
};

const isFacilityType = (value: string | null): value is FacilityType =>
  Boolean(value && FACILITY_TYPES.includes(value as FacilityType));

const isFacilityStatus = (value: string | null): value is FacilityStatus =>
  Boolean(value && FACILITY_STATUSES.includes(value as FacilityStatus));

const isWeekday = (value: string | null): value is FacilityWeekday =>
  Boolean(value && WEEKDAYS.includes(value as FacilityWeekday));

const isProviderCompensationMode = (value: string | null): value is ProviderCompensationMode =>
  Boolean(value && PROVIDER_COMPENSATION_MODES.includes(value as ProviderCompensationMode));

const toBoolean = (value: unknown, fallback = false): boolean => coerceBoolean(value) ?? fallback;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

export const mapFacilityPhone = (payload: unknown): FacilityPhone | null => {
  const raw = toResourceRecord(payload);
  const phone = coerceString(raw.phone);
  if (!phone) {
    return null;
  }
  return {
    id: coerceId(raw.id) || phone,
    phone,
    label: coerceString(raw.label),
    isPrimary: toBoolean(raw.is_primary ?? raw.isPrimary)
  };
};

export const mapFacilityOperatingHour = (payload: unknown): FacilityOperatingHour | null => {
  const raw = toResourceRecord(payload);
  const weekdayRaw = coerceString(raw.weekday);
  if (!isWeekday(weekdayRaw)) {
    return null;
  }
  return {
    id: coerceId(raw.id) || weekdayRaw,
    weekday: weekdayRaw,
    openTime: coerceString(raw.open_time ?? raw.openTime),
    closeTime: coerceString(raw.close_time ?? raw.closeTime),
    isClosed: toBoolean(raw.is_closed ?? raw.isClosed),
    is24Hours: toBoolean(raw.is_24_hours ?? raw.is24Hours)
  };
};

export const mapFacilityServiceSummary = (payload: unknown): FacilityServiceSummary | null => {
  const raw = toResourceRecord(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  return {
    id,
    name: coerceString(raw.name) ?? "",
    key: coerceString(raw.key),
    basePriceCents: coerceNumber(raw.base_price_cents ?? raw.basePriceCents),
    defaultEstimateMinutes: coerceNumber(raw.default_estimate_minutes ?? raw.defaultEstimateMinutes)
  };
};

export const mapFacilityService = (payload: unknown): FacilityService | null => {
  const raw = toResourceRecord(payload);
  const serviceRaw = raw.service ? toResourceRecord(raw.service) : {};
  const id = coerceId(raw.id) || coerceId(raw.facility_service_id ?? raw.facilityServiceId);
  const serviceId = coerceId(raw.service_id ?? raw.serviceId ?? serviceRaw.id);
  if (!id || !serviceId) {
    return null;
  }
  return {
    id,
    facilityId: coerceId(raw.facility_id ?? raw.facilityId),
    serviceId,
    priceCents: coerceNumber(raw.price_cents ?? raw.priceCents) ?? 0,
    currency: coerceString(raw.currency) ?? "KES",
    estimateDurationMinutes: coerceNumber(raw.estimate_duration_minutes ?? raw.estimateDurationMinutes),
    active: toBoolean(raw.active, true),
    isEmergencyCapable: toBoolean(raw.is_emergency_capable ?? raw.isEmergencyCapable),
    service: mapFacilityServiceSummary(raw.service ?? { ...serviceRaw, id: serviceId })
  };
};

export const mapFacilityAdmin = (payload: unknown): FacilityAdmin | null => {
  const raw = toResourceRecord(payload);
  const id = coerceId(raw.id) || coerceId(raw.user_id ?? raw.userId);
  const userId = coerceId(raw.user_id ?? raw.userId);
  if (!id || !userId) {
    return null;
  }
  return {
    id,
    facilityId: coerceId(raw.facility_id ?? raw.facilityId),
    userId,
    roleKey: coerceString(raw.role_key ?? raw.roleKey) ?? "admin.ops",
    active: toBoolean(raw.active, true)
  };
};

export const mapFacility = (payload: unknown): Facility | null => {
  const raw = toResourceRecord(payload);
  const id = coerceId(raw.id);
  const facilityType = coerceString(raw.facility_type ?? raw.facilityType);
  const status = coerceString(raw.status);
  if (!id || !isFacilityType(facilityType) || !isFacilityStatus(status)) {
    return null;
  }
  return {
    id,
    name: coerceString(raw.name) ?? "",
    facilityType,
    address: coerceString(raw.address) ?? "",
    county: coerceString(raw.county) ?? "",
    email: coerceString(raw.email) ?? "",
    status,
    lat: coerceNumber(raw.lat),
    lng: coerceNumber(raw.lng),
    platformFeePercent: coerceNumber(raw.platform_fee_percent ?? raw.platformFeePercent) ?? 0,
    providerFinancialsVisible: toBoolean(raw.provider_financials_visible ?? raw.providerFinancialsVisible, true),
    approvedAt: coerceDate(raw.approved_at ?? raw.approvedAt),
    suspendedAt: coerceDate(raw.suspended_at ?? raw.suspendedAt),
    phones: (Array.isArray(raw.phones) ? raw.phones : [])
      .map((phone) => mapFacilityPhone(phone))
      .filter((phone): phone is FacilityPhone => Boolean(phone)),
    operatingHours: (Array.isArray(raw.operating_hours ?? raw.operatingHours) ? raw.operating_hours ?? raw.operatingHours : [])
      .map((hour) => mapFacilityOperatingHour(hour))
      .filter((hour): hour is FacilityOperatingHour => Boolean(hour)),
    services: (Array.isArray(raw.services) ? raw.services : [])
      .map((service) => mapFacilityService(service))
      .filter((service): service is FacilityService => Boolean(service)),
    admins: (Array.isArray(raw.admins) ? raw.admins : [])
      .map((admin) => mapFacilityAdmin(admin))
      .filter((admin): admin is FacilityAdmin => Boolean(admin))
  };
};

export const mapFacilities = (payload: unknown): Facility[] =>
  Array.isArray(payload)
    ? payload.map((entry) => mapFacility(entry)).filter((facility): facility is Facility => Boolean(facility))
    : [];

export const mapFacilityDiscoveryItem = (payload: unknown): FacilityDiscoveryItem | null => {
  const raw = toResourceRecord(payload);
  const id = coerceId(raw.id);
  const facilityType = coerceString(raw.facility_type ?? raw.facilityType);
  // Discovery response: raw.service has { id: catalogServiceId, facility_service_id: fsId, price_cents, ... }
  const svcRaw = raw.service ? toResourceRecord(raw.service) : null;
  // Build a FacilityService-compatible object from the flat discovery service block
  const service: FacilityService | null = svcRaw
    ? {
        id: coerceId(svcRaw.facility_service_id ?? svcRaw.facilityServiceId ?? svcRaw.id) ?? "",
        facilityId: id ?? undefined,
        serviceId: coerceId(svcRaw.id) ?? undefined,
        priceCents: coerceNumber(svcRaw.price_cents ?? svcRaw.priceCents) ?? 0,
        currency: coerceString(svcRaw.currency) ?? "KES",
        estimateDurationMinutes: coerceNumber(svcRaw.estimate_duration_minutes ?? svcRaw.estimateDurationMinutes),
        active: true,
        isEmergencyCapable: toBoolean(svcRaw.is_emergency_capable ?? svcRaw.isEmergencyCapable),
        service: null
      }
    : null;
  if (!id || !isFacilityType(facilityType) || !service) {
    return null;
  }
  return {
    id,
    name: coerceString(raw.name) ?? "",
    facilityType,
    address: coerceString(raw.address) ?? "",
    county: coerceString(raw.county) ?? "",
    lat: coerceNumber(raw.lat),
    lng: coerceNumber(raw.lng),
    distanceM: coerceNumber(raw.distance_m ?? raw.distanceM),
    operatingStatus: coerceString(raw.operating_status ?? raw.operatingStatus),
    availabilitySignal: coerceString(raw.availability_signal ?? raw.availabilitySignal),
    service
  };
};

export const mapFacilityDiscoveryResult = (payload: unknown): FacilityDiscoveryResult => {
  const raw = toObject(payload);
  const facilities = Array.isArray(raw.facilities)
    ? raw.facilities
      .map((facility) => mapFacilityDiscoveryItem(facility))
      .filter((facility): facility is FacilityDiscoveryItem => Boolean(facility))
    : [];
  return {
    radiusM: coerceNumber(raw.radius_m ?? raw.radiusM),
    nextRadiusM: coerceNumber(raw.next_radius_m ?? raw.nextRadiusM),
    facilities
  };
};

export const isFacilityAlwaysOpen = (hours: FacilityOperatingHour[]): boolean =>
  WEEKDAYS.every((weekday) => hours.some((hour) => hour.weekday === weekday && hour.is24Hours && !hour.isClosed));

const weekdayLabel = (weekday: FacilityWeekday): string => weekday.charAt(0).toUpperCase() + weekday.slice(1);

export const formatOperatingHoursSummary = (hours: FacilityOperatingHour[]): string => {
  if (hours.length === 0) {
    return "Hours unavailable";
  }
  if (isFacilityAlwaysOpen(hours)) {
    return "Open 24/7";
  }
  const openDays = hours
    .filter((hour) => !hour.isClosed)
    .slice(0, 3)
    .map((hour) => {
      if (hour.is24Hours) {
        return `${weekdayLabel(hour.weekday)} 24 hours`;
      }
      return `${weekdayLabel(hour.weekday)} ${hour.openTime ?? "--"}-${hour.closeTime ?? "--"}`;
    });
  return openDays.length > 0 ? openDays.join(", ") : "Closed";
};

export const mapProviderCompensation = (payload: unknown): ProviderCompensation => {
  const raw = toResourceRecord(payload);
  const modeRaw = coerceString(raw.mode ?? raw.compensation_mode ?? raw.compensationMode);
  const mode = isProviderCompensationMode(modeRaw) ? modeRaw : "employee";
  return {
    mode,
    fixedPayoutCents: coerceNumber(raw.fixed_payout_cents ?? raw.fixedPayoutCents),
    payoutPercentage: coerceNumber(raw.payout_percentage ?? raw.payoutPercentage)
  };
};

export const formatProviderCompensation = (
  compensation: ProviderCompensation,
  currency = "KES"
): string => {
  if (compensation.mode === "employee") {
    return "Employee";
  }
  if (compensation.mode === "fixed") {
    const amount = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      (compensation.fixedPayoutCents ?? 0) / 100
    );
    return `${amount} fixed`;
  }
  return `${compensation.payoutPercentage ?? 0}% split`;
};

export const canViewProviderFinancials = (
  facility: Pick<Facility, "providerFinancialsVisible">,
  roles: string[]
): boolean => {
  const roleSet = new Set(toStringArray(roles));
  if (roleSet.has("admin.super") || roleSet.has("admin.ops") || roleSet.has("admin")) {
    return true;
  }
  return facility.providerFinancialsVisible;
};

export type FacilityCreateInput = {
  name: string;
  facilityType: FacilityType;
  address: string;
  county: string;
  phones: Array<Pick<FacilityPhone, "phone" | "label" | "isPrimary">>;
  email: string;
  lat?: number | null;
  lng?: number | null;
  operatingHours: Array<Omit<FacilityOperatingHour, "id">>;
  initialAdminEmail: string;
  platformFeePercent: number;
};

export type FacilityUpdateInput = Partial<{
  name: string;
  facilityType: FacilityType;
  address: string;
  county: string;
  phones: Array<Pick<FacilityPhone, "phone" | "label" | "isPrimary">>;
  email: string;
  lat: number | null;
  lng: number | null;
  operatingHours: Array<Omit<FacilityOperatingHour, "id">>;
  platformFeePercent: number;
  providerFinancialsVisible: boolean;
}>;

export type FacilityServiceInput = {
  serviceId: string;
  priceCents: number;
  currency?: string;
  estimateDurationMinutes?: number | null;
  active?: boolean;
  isEmergencyCapable?: boolean;
};

export type FacilityBookingAssignmentInput = {
  providerUserId: string;
  reason?: string;
};
