import api from "./api";
import { mapWalletAccount, mapWalletWithdrawal } from "../schemas/wallet";
import type { WalletAccountResource, WalletWithdrawal } from "../schemas/wallet";
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
    total: toInt(raw.total, fallback.total),
    page: toInt(raw.page, fallback.page),
    size: toInt(raw.size, fallback.size),
    totalPages: toInt(raw.total_pages ?? raw.totalPages, fallback.totalPages)
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

export const requestWithdrawal = async (amountCents: number, reason?: string) => {
  const response = await api.post("/wallet/withdrawals", {
    amount_cents: amountCents,
    reason
  });
  return response.data?.data as { id: string; status: string };
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

export const fetchAdminWithdrawal = async (withdrawalId: string): Promise<WalletWithdrawal> => {
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/wallet/withdrawals/${withdrawalId}`);
  const withdrawal = mapWalletWithdrawal(response.data?.data);
  if (!withdrawal) {
    throw new Error("Withdrawal not found");
  }
  return withdrawal;
};
