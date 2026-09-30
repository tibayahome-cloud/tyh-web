import { mpesaPhoneValidationError, normalizeMpesaPhone } from "../../../shared/utils/mpesaPhone";

export type PayerMode = "saved" | "other";

export type PayerResolution = {
  // 2547XXXXXXXX / 2541XXXXXXXX, ready to send. Null while the choice is not yet payable.
  phone: string | null;
  // The number as people write it (0712 345 678); empty while there is nothing to show.
  display: string;
  // True when this payment will be charged to a number other than the saved one.
  isAlternate: boolean;
  error: string | null;
};

// 254712345678 -> "0712 345 678"
export const formatMsisdn = (normalized: string): string => {
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
};

const NO_SAVED_NUMBER =
  "There is no valid Safaricom number saved on your account. Enter the number to pay with.";

// Decides which number an M-Pesa request would go to and whether it is acceptable. The saved
// number on the account is only ever read here: a different number is used for one payment and
// never written back.
export const resolvePayer = ({
  mode,
  savedPhone,
  otherInput
}: {
  mode: PayerMode;
  savedPhone: string | null | undefined;
  otherInput: string;
}): PayerResolution => {
  const saved = savedPhone ? normalizeMpesaPhone(savedPhone) : null;

  if (mode === "saved") {
    if (!saved) {
      return { phone: null, display: "", isAlternate: false, error: NO_SAVED_NUMBER };
    }
    return { phone: saved, display: formatMsisdn(saved), isAlternate: false, error: null };
  }

  const error = mpesaPhoneValidationError(otherInput);
  if (error) {
    return { phone: null, display: "", isAlternate: false, error };
  }
  const normalized = normalizeMpesaPhone(otherInput) as string;
  return { phone: normalized, display: formatMsisdn(normalized), isAlternate: normalized !== saved, error: null };
};

export const hasUsableSavedNumber = (savedPhone: string | null | undefined): boolean =>
  Boolean(savedPhone && normalizeMpesaPhone(savedPhone));
