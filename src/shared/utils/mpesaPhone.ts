// M-Pesa STK push requires a Safaricom-reachable Kenyan MSISDN. Accepts the shapes people
// actually type -- 07xxxxxxxx, 01xxxxxxxx, +2547xxxxxxxx, 2547xxxxxxxx, with optional spaces or
// dashes -- and normalizes to the 2547xxxxxxxx / 2541xxxxxxxx form the backend expects.
const KENYA_MSISDN_PATTERN = /^(?:\+?254|0)([17]\d{8})$/;

export const normalizeMpesaPhone = (rawInput: string): string | null => {
  const digitsAndPlus = rawInput.replace(/[\s-]/g, "");
  const match = digitsAndPlus.match(KENYA_MSISDN_PATTERN);
  if (!match) {
    return null;
  }
  return `254${match[1]}`;
};

export const isValidMpesaPhone = (rawInput: string): boolean => normalizeMpesaPhone(rawInput) !== null;

export const mpesaPhoneValidationError = (rawInput: string): string | null => {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return "An M-Pesa phone number is required to pay for this appointment.";
  }
  if (!isValidMpesaPhone(trimmed)) {
    return "Enter a valid Safaricom number, e.g. 0712 345 678.";
  }
  return null;
};
