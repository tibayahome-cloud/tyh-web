import api from "./api";
import { buildFieldParams, providerProfile } from "./fieldInclude";
import { mapBooking, mapBookingListMeta, mapBookings } from "../schemas/booking";
import type { Booking, BookingListMeta } from "../schemas/booking";
import { mapProvider, mapProviders, type Provider } from "../schemas/provider";
import {
  mapFacilities,
  mapFacility,
  mapFacilityAdmin,
  mapFacilityDiscoveryResult,
  mapFacilityService,
  type BookingRequestMode,
  type Facility,
  type FacilityOverview,
  type FacilityAdmin,
  type FacilityBookingAssignmentInput,
  type FacilityCreateInput,
  type FacilityDiscoveryResult,
  type FacilityService,
  type FacilityServiceInput,
  type FacilityStatus,
  type FacilityUpdateInput,
  type ProviderCompensation
} from "../schemas/facility";

export type FacilityListParams = {
  page?: number;
  pageSize?: number;
  status?: FacilityStatus;
  facilityType?: string;
  search?: string;
};

export type FacilityListResult = {
  facilities: Facility[];
  meta: BookingListMeta;
  raw?: Record<string, unknown>;
};

export type FacilityDiscoveryParams = {
  serviceId: string;
  lat: number;
  lng: number;
  excludeFacilityId?: string;
};

export type FacilityBookingListParams = {
  page?: number;
  pageSize?: number;
  status?: string;
  facilityStatus?: string;
};

export type FacilityBookingListResult = {
  bookings: Booking[];
  meta: BookingListMeta;
  raw?: Record<string, unknown>;
};

export type ProviderCompensationInput = {
  mode: ProviderCompensation["mode"];
  fixedPayoutCents?: number | null;
  payoutPercentage?: number | null;
};

export type FacilityProviderBootstrapInput = {
  services?: string[];
  compensation?: ProviderCompensationInput;
};

export type FacilityProviderListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  verified?: boolean;
};

export type FacilityProviderListResult = {
  providers: Provider[];
  meta: BookingListMeta;
  raw?: Record<string, unknown>;
};

export type FacilityProviderBootstrapResult = {
  provider: Provider | null;
  application: unknown;
};

export type FacilityProviderOnboardingInput = {
  fullName: string;
  email?: string;
  phone?: string;
  serviceIds: string[];
  invitationChannel?: "email" | "sms";
  compensation: ProviderCompensationInput;
  providerFinancialsVisible: boolean | null;
};

export type FacilityProviderOnboardingResult = FacilityProviderBootstrapResult & {
  created: boolean;
  invitationSent: boolean;
};

export type FacilityAdminInvitation = {
  created: boolean;
  facilityAdminId: string;
  userId: string;
  invitationSent: boolean;
  invitationExpiresAt: string | null;
};

export type FacilityAdminInvitationStatus = {
  status: "not_issued" | "pending" | "completed" | "expired" | "revoked";
  resetId: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
};

export type FacilityAdminInvitationResendResult = {
  invitationSent: boolean;
  invitationExpiresAt: string | null;
};

export type FacilityCreateResult = {
  facility: Facility;
  adminInvitation: FacilityAdminInvitation | null;
};

export type FacilityProviderUpdateInput = {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  serviceIds?: string[];
  providerFinancialsVisible?: boolean | null;
  compensation?: ProviderCompensationInput;
};

export type FacilityProviderLifecycleInput = {
  status?: "pending" | "active" | "suspended";
  verified?: boolean;
  isAvailable?: boolean;
};

export type FacilityProviderApplicationReviewInput = {
  approved: boolean;
  notes?: string;
};

const payloadData = (payload: unknown): unknown => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
};

const mapListMeta = (meta: unknown, page: number, pageSize: number, total: number): BookingListMeta =>
  mapBookingListMeta(meta, {
    page: {
      number: page,
      size: pageSize,
      total,
      totalPages: 1
    }
  });

const operatingHoursPayload = (hours: FacilityCreateInput["operatingHours"]) =>
  hours.map((hour) => ({
    weekday: hour.weekday,
    open_time: hour.openTime,
    close_time: hour.closeTime,
    is_closed: hour.isClosed,
    is_24_hours: hour.is24Hours
  }));

const phonePayload = (phones: FacilityCreateInput["phones"]) =>
  phones.map((phone) => ({
    phone: phone.phone,
    label: phone.label,
    is_primary: phone.isPrimary
  }));

export const facilityCreatePayload = (input: FacilityCreateInput): Record<string, unknown> => ({
  name: input.name,
  facility_type: input.facilityType,
  address: input.address,
  county: input.county,
  country_code: input.countryCode,
  phones: phonePayload(input.phones),
  email: input.email,
  lat: input.lat,
  lng: input.lng,
  operating_hours: operatingHoursPayload(input.operatingHours),
  initial_admin_email: input.initialAdminEmail,
  platform_fee_percent: input.platformFeePercent
});

export const facilityUpdatePayload = (input: FacilityUpdateInput): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.facilityType !== undefined) payload.facility_type = input.facilityType;
  if (input.address !== undefined) payload.address = input.address;
  if (input.county !== undefined) payload.county = input.county;
  if (input.countryCode !== undefined) payload.country_code = input.countryCode;
  if (input.phones !== undefined) payload.phones = phonePayload(input.phones);
  if (input.email !== undefined) payload.email = input.email;
  if (input.lat !== undefined) payload.lat = input.lat;
  if (input.lng !== undefined) payload.lng = input.lng;
  if (input.operatingHours !== undefined) payload.operating_hours = operatingHoursPayload(input.operatingHours);
  if (input.platformFeePercent !== undefined) payload.platform_fee_percent = input.platformFeePercent;
  if (input.providerFinancialsVisible !== undefined) {
    payload.provider_financials_visible = input.providerFinancialsVisible;
  }
  return payload;
};

export const facilityServicePayload = (input: FacilityServiceInput): Record<string, unknown> => ({
  service_id: input.serviceId,
  price_cents: input.priceCents,
  currency: input.currency ?? "KES",
  estimate_duration_minutes: input.estimateDurationMinutes,
  active: input.active ?? true,
  is_emergency_capable: input.isEmergencyCapable ?? false
});

export const facilityServiceUpdatePayload = (input: Partial<FacilityServiceInput>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (input.serviceId !== undefined) payload.service_id = input.serviceId;
  if (input.priceCents !== undefined) payload.price_cents = input.priceCents;
  if (input.currency !== undefined) payload.currency = input.currency;
  if (input.estimateDurationMinutes !== undefined) payload.estimate_duration_minutes = input.estimateDurationMinutes;
  if (input.active !== undefined) payload.active = input.active;
  if (input.isEmergencyCapable !== undefined) payload.is_emergency_capable = input.isEmergencyCapable;
  return payload;
};

export const providerCompensationPayload = (input: ProviderCompensationInput): Record<string, unknown> => ({
  mode: input.mode,
  fixed_payout_cents: input.fixedPayoutCents,
  payout_percentage: input.payoutPercentage
});

export const fetchFacilities = async ({
  page = 1,
  pageSize = 25,
  status,
  facilityType,
  search
}: FacilityListParams = {}): Promise<FacilityListResult> => {
  const params: Record<string, unknown> = {
    "page[number]": page,
    "page[size]": pageSize
  };
  if (status) params["filter[status]"] = status;
  if (facilityType) params["filter[facility_type]"] = facilityType;
  if (search) params["filter[q]"] = search;

  const response = await api.get("/facilities", { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  const facilities = mapFacilities(data);
  return { facilities, meta: mapListMeta(payload.meta, page, pageSize, facilities.length), raw: payload };
};

export const fetchFacility = async (facilityId: string): Promise<Facility> => {
  const response = await api.get(`/facilities/${facilityId}`);
  const facility = mapFacility(payloadData(response.data));
  if (!facility) {
    throw new Error("Facility not found");
  }
  return facility;
};

export const fetchFacilityOverview = async (facilityId: string): Promise<FacilityOverview> => {
  const response = await api.get(`/facilities/${facilityId}/overview`);
  const raw = payloadData(response.data) as Record<string, unknown>;
  const facility = mapFacility(raw.facility);
  const metrics = (raw.metrics ?? {}) as Record<string, unknown>;
  const readiness = (raw.readiness ?? {}) as Record<string, unknown>;
  if (!facility) {
    throw new Error("Facility overview not found");
  }
  return {
    facility,
    metrics: {
      openBookings: Number(metrics.open_bookings) || 0,
      unassignedBookings: Number(metrics.unassigned_bookings) || 0,
      providersTotal: Number(metrics.providers_total) || 0,
      providersAvailable: Number(metrics.providers_available) || 0,
      providersPendingVerification: Number(metrics.providers_pending_verification) || 0,
      activeServices: Number(metrics.active_services) || 0
    },
    readiness: {
      locationReady: Boolean(readiness.location_ready),
      contactReady: Boolean(readiness.contact_ready),
      operatingHoursConfigured: Boolean(readiness.operating_hours_configured)
    }
  };
};

export const createFacility = async (input: FacilityCreateInput): Promise<FacilityCreateResult> => {
  const response = await api.post("/facilities", facilityCreatePayload(input));
  const data = payloadData(response.data) as Record<string, unknown>;
  const facility = mapFacility(data?.facility ?? data);
  if (!facility) {
    throw new Error("Failed to create facility");
  }
  const invitation = data?.admin_invitation as Record<string, unknown> | undefined;
  return {
    facility,
    adminInvitation: invitation
      ? {
          created: Boolean(invitation.created),
          facilityAdminId: String(invitation.facility_admin_id ?? ""),
          userId: String(invitation.user_id ?? ""),
          invitationSent: Boolean(invitation.invitation_sent),
          invitationExpiresAt: invitation.invitation_expires_at ? String(invitation.invitation_expires_at) : null
        }
      : null
  };
};

export const updateFacility = async (facilityId: string, input: FacilityUpdateInput): Promise<Facility> => {
  const response = await api.patch(`/facilities/${facilityId}`, facilityUpdatePayload(input));
  const facility = mapFacility(payloadData(response.data));
  if (!facility) {
    throw new Error("Failed to update facility");
  }
  return facility;
};

export const updateFacilityStatus = async (facilityId: string, status: FacilityStatus): Promise<Facility> => {
  const response = await api.patch(`/facilities/${facilityId}/status`, { status });
  const facility = mapFacility(payloadData(response.data));
  if (!facility) {
    throw new Error("Failed to update facility status");
  }
  return facility;
};

export const assignFacilityAdmin = async (facilityId: string, email: string): Promise<FacilityAdmin> => {
  const response = await api.post(`/facilities/${facilityId}/admins`, { email });
  const admin = mapFacilityAdmin(payloadData(response.data));
  if (!admin) {
    throw new Error("Failed to assign facility admin");
  }
  return admin;
};

export const fetchFacilityAdminInvitationStatus = async (
  facilityId: string,
  userId: string
): Promise<FacilityAdminInvitationStatus> => {
  const response = await api.get(`/facilities/${facilityId}/admins/${userId}/invitation`);
  const data = payloadData(response.data) as Record<string, unknown>;
  return {
    status: String(data.status ?? "not_issued") as FacilityAdminInvitationStatus["status"],
    resetId: data.reset_id ? String(data.reset_id) : null,
    expiresAt: data.expires_at ? String(data.expires_at) : null,
    redeemedAt: data.redeemed_at ? String(data.redeemed_at) : null
  };
};

export const resendFacilityAdminInvitation = async (
  facilityId: string,
  userId: string
): Promise<FacilityAdminInvitationResendResult> => {
  const response = await api.post(`/facilities/${facilityId}/admins/${userId}/invitation/resend`);
  const data = payloadData(response.data) as Record<string, unknown>;
  return {
    invitationSent: Boolean(data.invitation_sent),
    invitationExpiresAt: data.invitation_expires_at ? String(data.invitation_expires_at) : null
  };
};

export const discoverFacilities = async ({
  serviceId,
  lat,
  lng,
  excludeFacilityId
}: FacilityDiscoveryParams): Promise<FacilityDiscoveryResult> => {
  const response = await api.get("/facilities/discover", {
    params: {
      service_id: serviceId,
      lat,
      lng,
      ...(excludeFacilityId ? { exclude_facility_id: excludeFacilityId } : {})
    }
  });
  return mapFacilityDiscoveryResult(payloadData(response.data));
};

export const fetchFacilityServices = async (facilityId: string): Promise<FacilityService[]> => {
  const response = await api.get(`/facilities/${facilityId}/services`);
  const data = payloadData(response.data);
  return Array.isArray(data)
    ? data.map((entry) => mapFacilityService(entry)).filter((entry): entry is FacilityService => Boolean(entry))
    : [];
};

export const createFacilityService = async (
  facilityId: string,
  input: FacilityServiceInput
): Promise<FacilityService> => {
  const response = await api.post(`/facilities/${facilityId}/services`, facilityServicePayload(input));
  const service = mapFacilityService(payloadData(response.data));
  if (!service) {
    throw new Error("Failed to create facility service");
  }
  return service;
};

export const replaceFacilityServices = async (
  facilityId: string,
  services: FacilityServiceInput[]
): Promise<FacilityService[]> => {
  const response = await api.put(`/facilities/${facilityId}/services`, services.map(facilityServicePayload));
  const data = payloadData(response.data);
  return Array.isArray(data)
    ? data.map((entry) => mapFacilityService(entry)).filter((entry): entry is FacilityService => Boolean(entry))
    : [];
};

export const updateFacilityService = async (
  facilityId: string,
  facilityServiceId: string,
  input: Partial<FacilityServiceInput>
): Promise<FacilityService> => {
  const response = await api.patch(
    `/facilities/${facilityId}/services/${facilityServiceId}`,
    facilityServiceUpdatePayload(input)
  );
  const service = mapFacilityService(payloadData(response.data));
  if (!service) {
    throw new Error("Failed to update facility service");
  }
  return service;
};

export const deleteFacilityService = async (facilityId: string, facilityServiceId: string): Promise<void> => {
  await api.delete(`/facilities/${facilityId}/services/${facilityServiceId}`);
};

export const fetchFacilityBookings = async (
  facilityId: string,
  { page = 1, pageSize = 25, status, facilityStatus }: FacilityBookingListParams = {}
): Promise<FacilityBookingListResult> => {
  const params: Record<string, unknown> = {
    "page[number]": page,
    "page[size]": pageSize
  };
  if (status) params["filter[status]"] = status;
  if (facilityStatus) params["filter[facility_status]"] = facilityStatus;

  const response = await api.get(`/facilities/${facilityId}/bookings`, { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  const bookings = mapBookings(data);
  return { bookings, meta: mapListMeta(payload.meta, page, pageSize, bookings.length), raw: payload };
};

export const assignFacilityBookingProvider = async (
  facilityId: string,
  bookingId: string,
  input: FacilityBookingAssignmentInput
): Promise<Booking> => {
  const response = await api.post(`/facilities/${facilityId}/bookings/${bookingId}/assign`, {
    provider_user_id: input.providerUserId,
    reason: input.reason
  });
  const booking = mapBooking(payloadData(response.data));
  if (!booking) {
    throw new Error("Failed to assign provider");
  }
  return booking;
};

export const updateFacilityProviderCompensation = async (
  facilityId: string,
  providerUserId: string,
  input: ProviderCompensationInput
): Promise<Provider> => {
  const response = await api.patch(
    `/facilities/${facilityId}/providers/${providerUserId}/compensation`,
    providerCompensationPayload(input)
  );
  const provider = mapProvider(payloadData(response.data));
  if (!provider) {
    throw new Error("Failed to update provider compensation");
  }
  return provider;
};

export const updateFacilityProvider = async (
  facilityId: string,
  providerUserId: string,
  input: FacilityProviderUpdateInput
): Promise<Provider> => {
  const response = await api.patch(`/facilities/${facilityId}/providers/${providerUserId}`, {
    ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.serviceIds !== undefined ? { service_ids: input.serviceIds } : {}),
    ...(input.providerFinancialsVisible !== undefined
      ? { provider_financials_visible: input.providerFinancialsVisible }
      : {}),
    ...(input.compensation ? providerCompensationPayload(input.compensation) : {})
  });
  const provider = mapProvider(payloadData(response.data));
  if (!provider) {
    throw new Error("Failed to update provider");
  }
  return provider;
};

export const updateFacilityProviderLifecycle = async (
  facilityId: string,
  providerUserId: string,
  input: FacilityProviderLifecycleInput
): Promise<Provider> => {
  const response = await api.patch(
    `/facilities/${facilityId}/providers/${providerUserId}/lifecycle`,
    {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.verified !== undefined ? { verified: input.verified } : {}),
      ...(input.isAvailable !== undefined ? { is_available: input.isAvailable } : {})
    }
  );
  const provider = mapProvider(payloadData(response.data));
  if (!provider) {
    throw new Error("Failed to update provider lifecycle");
  }
  return provider;
};

export const fetchFacilityProviders = async (
  facilityId: string,
  { page = 1, pageSize = 25, search, verified }: FacilityProviderListParams = {}
): Promise<FacilityProviderListResult> => {
  const params: Record<string, unknown> = {
    ...buildFieldParams(providerProfile),
    "filter[facility_id]": facilityId,
    "page[number]": page,
    "page[size]": pageSize
  };
  if (search) params["filter[q]"] = search;
  if (verified !== undefined) params["filter[verified]"] = String(verified);

  const response = await api.get("/providers", { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const providers = mapProviders(rows).filter((provider) => provider.facilityId === facilityId);
  return { providers, meta: mapListMeta(payload.meta, page, pageSize, providers.length), raw: payload };
};

export const bootstrapFacilityProvider = async (
  facilityId: string,
  userId: string,
  input: FacilityProviderBootstrapInput = {}
): Promise<FacilityProviderBootstrapResult> => {
  const response = await api.post(`/facilities/${facilityId}/providers/${userId}/bootstrap`, {
    services: input.services,
    compensation: input.compensation ? providerCompensationPayload(input.compensation) : undefined
  });
  const data = payloadData(response.data) as Record<string, unknown>;
  return {
    provider: mapProvider(data.provider),
    application: data.application
  };
};

export const createFacilityProvider = async (
  facilityId: string,
  input: FacilityProviderOnboardingInput
): Promise<FacilityProviderOnboardingResult> => {
  const response = await api.post(`/facilities/${facilityId}/providers`, {
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    service_ids: input.serviceIds,
    invitation_channel: input.invitationChannel,
    compensation_mode: input.compensation.mode,
    fixed_payout_cents: input.compensation.fixedPayoutCents,
    payout_percentage: input.compensation.payoutPercentage,
    provider_financials_visible: input.providerFinancialsVisible
  });
  const data = payloadData(response.data) as Record<string, unknown>;
  return {
    provider: mapProvider(data.provider),
    application: data.application,
    created: Boolean(data.created),
    invitationSent: Boolean(data.invitation_sent)
  };
};

export const reviewFacilityProviderApplication = async (
  facilityId: string,
  applicationId: string,
  input: FacilityProviderApplicationReviewInput
): Promise<void> => {
  await api.patch(`/facilities/${facilityId}/provider-applications/${applicationId}/review`, {
    approved: input.approved,
    notes: input.notes
  });
};

export type BookingFacilitySelectionInput = {
  facilityId: string;
  requestMode: BookingRequestMode;
};
