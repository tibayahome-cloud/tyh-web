import api from "./api";
import { mapWalletAccount, mapWalletWithdrawal } from "../schemas/wallet";
import {
  mapProviderEarningsSummary,
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

export const fetchAdminWithdrawal = async (withdrawalId: string): Promise<WalletWithdrawal> => {
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/wallet/withdrawals/${withdrawalId}`);
  const withdrawal = mapWalletWithdrawal(response.data?.data);
  if (!withdrawal) {
    throw new Error("Withdrawal not found");
  }
  return withdrawal;
};
