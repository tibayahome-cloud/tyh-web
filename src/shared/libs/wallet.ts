import api from "./api";
import { mapWalletAccount, mapWalletWithdrawal } from "../schemas/wallet";
import {
  mapFacilityEarningsSummary,
  mapProviderEarningsSummary,
  type FacilityEarningsSummary,
  type ProviderEarningsSummary,
  type WalletAccountResource,
  type WalletWithdrawal
} from "../schemas/wallet";
import { buildFieldParams, walletAccountPreset } from "./fieldInclude";

const ADMIN_PAYMENTS_BASE = "/admin/payments";

export type WithdrawalListMeta = {
  total: number;
  page: number;
  size: number;
  totalPages: number;
};

const mapListMeta = (meta: unknown, fallback: WithdrawalListMeta): WithdrawalListMeta => {
  if (!meta || typeof meta !== "object") {
    return fallback;
  }
  const raw = meta as Record<string, unknown>;
  const pageMeta = raw.page && typeof raw.page === "object" ? raw.page as Record<string, unknown> : {};
  const toInt = (value: unknown, defaultValue: number): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    }
    return defaultValue;
  };
  return {
    total: toInt(raw.total ?? pageMeta.total, fallback.total),
    page: toInt(typeof raw.page === "number" ? raw.page : pageMeta.number, fallback.page),
    size: toInt(raw.size ?? pageMeta.size, fallback.size),
    totalPages: toInt(raw.total_pages ?? raw.totalPages ?? pageMeta.total_pages ?? pageMeta.totalPages, fallback.totalPages)
  };
};

export type WithdrawalListResult = {
  withdrawals: WalletWithdrawal[];
  meta: WithdrawalListMeta;
  raw?: Record<string, unknown>;
};

export const fetchWalletAccount = async (): Promise<WalletAccountResource> => {
  const response = await api.get("/wallet", {
    params: buildFieldParams(walletAccountPreset)
  });
  const wallet = mapWalletAccount(response.data?.data);
  if (!wallet) {
    throw new Error("Wallet not found");
  }
  return wallet;
};

export const fetchProviderEarningsSummary = async (): Promise<ProviderEarningsSummary> => {
  const response = await api.get("/wallet/earnings-summary");
  const summary = mapProviderEarningsSummary(response.data?.data);
  if (!summary) {
    throw new Error("Earnings summary is unavailable");
  }
  return summary;
};

export const requestWithdrawal = async (amountCents: number, reason?: string, payoutPhoneNumber?: string) => {
  const response = await api.post("/wallet/withdrawals", {
    amount_cents: amountCents,
    reason,
    payout_phone_number: payoutPhoneNumber || undefined
  });
  return response.data?.data as { id: string; status: string };
};

export const requestPayoutDestination = async (phoneNumber: string) => {
  const response = await api.post("/wallet/payout-destinations", { phone_number: phoneNumber });
  return response.data?.data as { phone_masked: string | null; verified: boolean };
};

export const verifyPayoutDestination = async (phoneNumber: string, code: string) => {
  const response = await api.post("/wallet/payout-destinations/verify", {
    phone_number: phoneNumber,
    code
  });
  return response.data?.data as { phone_masked: string | null; verified: boolean };
};

export const approveWithdrawal = async (withdrawalId: string) => {
  const response = await api.post(`/wallet/withdrawals/${withdrawalId}/approve`);
  return response.data?.data;
};

export const rejectWithdrawal = async (withdrawalId: string, reason?: string) => {
  const response = await api.post(`/wallet/withdrawals/${withdrawalId}/reject`, { reason });
  return response.data?.data;
};

export const fetchAdminWithdrawals = async ({
  page = 1,
  size = 25,
  status
}: { page?: number; size?: number; status?: string } = {}): Promise<WithdrawalListResult> => {
  const params: Record<string, unknown> = {
    "page[number]": page,
    "page[size]": size
  };
  if (status) {
    params["filter[status]"] = status;
  }
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/wallet/withdrawals`, { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  const withdrawals = data
    .map((entry) => mapWalletWithdrawal(entry))
    .filter((entry): entry is WalletWithdrawal => Boolean(entry));
  const meta = mapListMeta(payload.meta, { total: withdrawals.length, page, size, totalPages: 1 });
  return { withdrawals, meta, raw: payload };
};

export const fetchFacilityWithdrawals = async (
  facilityId: string,
  { page = 1, size = 25, status }: { page?: number; size?: number; status?: string } = {}
): Promise<WithdrawalListResult> => {
  const params: Record<string, unknown> = {
    "page[number]": page,
    "page[size]": size
  };
  if (status) {
    params["filter[status]"] = status;
  }
  const response = await api.get(`/admin/payments/facilities/${facilityId}/withdrawals`, { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  const withdrawals = data
    .map((entry) => mapWalletWithdrawal(entry))
    .filter((entry): entry is WalletWithdrawal => Boolean(entry));
  const meta = mapListMeta(payload.meta, { total: withdrawals.length, page, size, totalPages: 1 });
  return { withdrawals, meta, raw: payload };
};

export const fetchFacilityEarningsSummary = async (facilityId: string): Promise<FacilityEarningsSummary> => {
  const response = await api.get(`/facilities/${facilityId}/wallet`);
  const summary = mapFacilityEarningsSummary(response.data?.data);
  if (!summary) {
    throw new Error("Facility earnings summary is unavailable");
  }
  return summary;
};

export const requestFacilityWithdrawal = async (facilityId: string, amountCents: number) => {
  const response = await api.post(`/facilities/${facilityId}/wallet/withdrawals`, {
    amount_cents: amountCents
  });
  return response.data?.data as { id: string; status: string; payoutId: string; payoutPhoneMasked: string | null };
};

export const requestFacilityPayoutDestination = async (facilityId: string, phoneNumber: string) => {
  const response = await api.post(`/facilities/${facilityId}/wallet/payout-destinations`, {
    phone_number: phoneNumber
  });
  return response.data?.data as { phone_masked: string | null; verified: boolean; active: boolean };
};

export const verifyFacilityPayoutDestination = async (facilityId: string, phoneNumber: string, code: string) => {
  const response = await api.post(`/facilities/${facilityId}/wallet/payout-destinations/verify`, {
    phone_number: phoneNumber,
    code
  });
  return response.data?.data as { phone_masked: string | null; verified: boolean; active: boolean };
};

export type FacilityPayoutTrustedMethod = {
  optionId: string;
  channel: string;
  label: string;
};

export type FacilityPayoutDestinationChange = {
  changeId: string;
  changeType: string;
  status: string;
  authorizationChannel: string;
  authorizationTargetMasked: string;
  newPhoneMasked: string;
  authorized: boolean;
  completed: boolean;
  failureReason: string | null;
};

const mapFacilityPayoutDestinationChange = (data: Record<string, unknown>): FacilityPayoutDestinationChange => ({
  changeId: String(data.change_id ?? ""),
  changeType: String(data.change_type ?? ""),
  status: String(data.status ?? ""),
  authorizationChannel: String(data.authorization_channel ?? ""),
  authorizationTargetMasked: String(data.authorization_target_masked ?? ""),
  newPhoneMasked: String(data.new_phone_masked ?? ""),
  authorized: Boolean(data.authorized),
  completed: Boolean(data.completed),
  failureReason: typeof data.failure_reason === "string" ? data.failure_reason : null
});

export const fetchFacilityPayoutTrustedMethods = async (
  facilityId: string
): Promise<FacilityPayoutTrustedMethod[]> => {
  const response = await api.get(`/facilities/${facilityId}/wallet/payout-destinations/trusted-methods`);
  const data = Array.isArray(response.data?.data) ? response.data.data : [];
  return data.map((entry: Record<string, unknown>) => ({
    optionId: String(entry.option_id ?? ""),
    channel: String(entry.channel ?? ""),
    label: String(entry.label ?? "")
  }));
};

export const startFacilityPayoutDestinationChange = async (
  facilityId: string,
  payload: { newPhoneNumber: string; optionId: string; idempotencyKey: string }
): Promise<FacilityPayoutDestinationChange> => {
  const response = await api.post(`/facilities/${facilityId}/wallet/payout-destinations/change`, {
    new_phone_number: payload.newPhoneNumber,
    option_id: payload.optionId,
    idempotency_key: payload.idempotencyKey
  });
  return mapFacilityPayoutDestinationChange(response.data?.data ?? {});
};

export const authorizeFacilityPayoutDestinationChange = async (
  facilityId: string,
  changeId: string,
  code: string
): Promise<FacilityPayoutDestinationChange> => {
  const response = await api.post(`/facilities/${facilityId}/wallet/payout-destinations/authorize`, {
    change_id: changeId,
    code
  });
  return mapFacilityPayoutDestinationChange(response.data?.data ?? {});
};

export const verifyNewFacilityPayoutDestination = async (
  facilityId: string,
  changeId: string,
  code: string
): Promise<FacilityPayoutDestinationChange> => {
  const response = await api.post(`/facilities/${facilityId}/wallet/payout-destinations/verify-new`, {
    change_id: changeId,
    code
  });
  return mapFacilityPayoutDestinationChange(response.data?.data ?? {});
};

export const resendFacilityPayoutDestinationCode = async (
  facilityId: string,
  changeId: string,
  purpose: string
): Promise<FacilityPayoutDestinationChange> => {
  const response = await api.post(`/facilities/${facilityId}/wallet/payout-destinations/resend`, {
    change_id: changeId,
    purpose
  });
  return mapFacilityPayoutDestinationChange(response.data?.data ?? {});
};

export const fetchAdminWithdrawal = async (withdrawalId: string): Promise<WalletWithdrawal> => {
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/wallet/withdrawals/${withdrawalId}`);
  const withdrawal = mapWalletWithdrawal(response.data?.data);
  if (!withdrawal) {
    throw new Error("Withdrawal not found");
  }
  return withdrawal;
};
