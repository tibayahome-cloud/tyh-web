import api from "./api";

const BASE = "/admin/payments/stranded-wallets";

// A wallet left behind by a deleted account. Amounts are in cents, as the API sends them.
export type StrandedWallet = {
  userId: string;
  fullName: string | null;
  deletedAt: string | null;
  currency: string;
  balanceCents: number;
  reservedCents: number;
  availableCents: number;
  withdrawalsInProgress: number;
  canSettle: boolean;
  blocker: string | null;
};

const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const count = (value: unknown): number => Number(value) || 0;

export const mapStrandedWallet = (value: unknown): StrandedWallet | null => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const userId = text(raw.user_id);
  if (!userId) return null;
  return {
    userId,
    fullName: text(raw.full_name),
    deletedAt: text(raw.deleted_at),
    currency: text(raw.currency) ?? "KES",
    balanceCents: count(raw.balance_cents),
    reservedCents: count(raw.reserved_cents),
    availableCents: count(raw.available_cents),
    withdrawalsInProgress: count(raw.withdrawals_in_progress),
    canSettle: raw.can_settle === true,
    blocker: text(raw.blocker)
  };
};

export const fetchStrandedWallets = async (): Promise<StrandedWallet[]> => {
  const response = await api.get(BASE);
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];
  return rows.map(mapStrandedWallet).filter((row: StrandedWallet | null): row is StrandedWallet => row !== null);
};

export type SettleInput = {
  userId: string;
  // The available balance the person was shown. The server refuses if it has changed.
  amountCents: number;
  phoneNumber: string;
  reason: string;
};

export const settleStrandedWallet = async ({ userId, amountCents, phoneNumber, reason }: SettleInput): Promise<void> => {
  await api.post(`${BASE}/${userId}/settle`, {
    amount_cents: amountCents,
    phone_number: phoneNumber,
    reason
  });
};

// The shillings a person types to confirm an amount ("1,000" or "1000.00" both mean KES 1,000), as cents,
// or null if it is not a plain amount.
export const parseTypedShillings = (typed: string): number | null => {
  const cleaned = typed.replace(/[\s,]/g, "").replace(/^kes/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
};
