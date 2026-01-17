import { z } from "zod";
import { coerceDate, coerceId, coerceNumber, coerceString, toObject } from "./helpers";

export const WalletTransactionSchema = z.object({
  id: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  transactionType: z.string(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  description: z.string().nullable(),
  postedAt: z.string().nullable(),
  metadata: z.record(z.unknown())
});

export type WalletTransaction = z.infer<typeof WalletTransactionSchema>;

export const WalletWithdrawalSchema = z.object({
  id: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  status: z.string(),
  channel: z.string(),
  reason: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  processedAt: z.string().nullable(),
  disbursedAt: z.string().nullable(),
  requestedByUserId: z.string().nullable(),
  reviewedByUserId: z.string().nullable()
});

export type WalletWithdrawal = z.infer<typeof WalletWithdrawalSchema>;

export const WalletAccountResourceSchema = z.object({
  id: z.string(),
  balanceCents: z.number(),
  pendingWithdrawalCents: z.number(),
  currency: z.string(),
  status: z.string(),
  transactions: z.array(WalletTransactionSchema),
  withdrawals: z.array(WalletWithdrawalSchema)
});

export type WalletAccountResource = z.infer<typeof WalletAccountResourceSchema>;

const mapTransaction = (payload: unknown): WalletTransaction | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  return {
    id,
    amountCents: coerceNumber(raw.amount_cents) ?? 0,
    currency: coerceString(raw.currency) ?? "KES",
    transactionType: coerceString(raw.transaction_type) ?? "adjustment",
    referenceType: coerceString(raw.reference_type),
    referenceId: coerceString(raw.reference_id),
    description: coerceString(raw.description),
    postedAt: coerceDate(raw.posted_at),
    metadata:
      raw.metadata && typeof raw.metadata === "object" ? (raw.metadata as Record<string, unknown>) : {}
  };
};

export const mapWalletWithdrawal = (payload: unknown): WalletWithdrawal | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  return {
    id,
    amountCents: coerceNumber(raw.amount_cents) ?? 0,
    currency: coerceString(raw.currency) ?? "KES",
    status: coerceString(raw.status) ?? "pending",
    channel: coerceString(raw.channel) ?? "mpesa_payout",
    reason: coerceString(raw.reason),
    rejectionReason: coerceString(raw.rejection_reason),
    processedAt: coerceDate(raw.processed_at),
    disbursedAt: coerceDate(raw.disbursed_at),
    requestedByUserId: coerceString(raw.requested_by_user_id),
    reviewedByUserId: coerceString(raw.reviewed_by_user_id)
  };
};

export const mapWalletAccount = (payload: unknown): WalletAccountResource | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const transactionsRaw = Array.isArray(raw.transactions)
    ? raw.transactions
    : Array.isArray(raw.ledger_entries)
      ? raw.ledger_entries
      : [];
  const withdrawalsRaw = Array.isArray(raw.withdrawals) ? raw.withdrawals : [];
  return {
    id,
    balanceCents: coerceNumber(raw.balance_cents) ?? 0,
    pendingWithdrawalCents: coerceNumber(raw.pending_withdrawal_cents) ?? 0,
    currency: coerceString(raw.currency) ?? "KES",
    status: coerceString(raw.status) ?? "active",
    transactions: transactionsRaw
      .map((entry) => mapTransaction(entry))
      .filter((entry): entry is WalletTransaction => Boolean(entry)),
    withdrawals: withdrawalsRaw
      .map((entry) => mapWalletWithdrawal(entry))
      .filter((entry): entry is WalletWithdrawal => Boolean(entry))
  };
};
