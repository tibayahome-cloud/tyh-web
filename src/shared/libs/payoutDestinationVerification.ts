/**
 * Payout-destination verification state machine.
 *
 * The only verification the backend performs today, for both provider and facility
 * withdrawals, is proof of control over a phone number via OTP:
 *   POST .../payout-destinations         {phone_number}         -> {phone_masked, verified, active}
 *   POST .../payout-destinations/verify  {phone_number, code}   -> {phone_masked, verified, active}
 * There is no network- or subscriber-name lookup in production, and per tyh-api (2026-09-17)
 * one may never exist in the form this UI anticipates: Safaricom's IMSI/SIM-Swap product (the
 * only avenue investigated so far) returns a hashed IMSI and no subscriber-name field in the
 * third-party docs reviewed, so "the backend returns a name" is a possibility being designed
 * for, not a confirmed contract.
 *
 * The lookup-outcome states below exist so the UI is ready the moment a real lookup endpoint
 * ships, gated behind MPESA_DESTINATION_LOOKUP_ENABLED (default off, and named to match the
 * flag tyh-api is building server-side). Until that flag is on and a real `lookupDestination`
 * function is wired in, the UI never enters a lookup-outcome state and never renders an account
 * name -- it only ever shows what the real OTP contract actually returned.
 */

export const MPESA_DESTINATION_LOOKUP_ENABLED =
  String(import.meta.env.VITE_MPESA_DESTINATION_LOOKUP_ENABLED ?? "false").toLowerCase() === "true";

/**
 * Outcome names match tyh-api's PayoutDestinationVerifier abstraction 1:1 (see tyh-api PR #91),
 * so the two sides need no translation layer.
 *
 * `verified_safaricom` and `name_unavailable` are deliberately distinct, per tyh-api
 * (2026-09-17): `verified_safaricom` means only "this is a Safaricom number" -- today's actual
 * response carries no name-related field at all, so it implies nothing about a name having been
 * looked up. `name_unavailable` is reserved for an explicit "a name lookup was attempted and
 * found nothing" signal, which no confirmed contract produces yet. The UI must never render
 * `verified_safaricom` as if it settled the name question one way or the other.
 */
export type PayoutLookupOutcome =
  | "verified_safaricom"
  | "unsupported_network"
  | "name_verified"
  | "name_unavailable"
  | "lookup_unavailable"
  | "verification_not_configured";

export type PayoutVerificationPhase =
  | "empty"
  | "format_invalid"
  | "format_valid"
  | "looking_up"
  | "lookup_result"
  | "sending_code"
  | "otp_required"
  | "verifying_code"
  | "otp_failed"
  | "verified_locked";

export type PayoutVerificationState = {
  phase: PayoutVerificationPhase;
  phoneMasked: string | null;
  lookupOutcome?: PayoutLookupOutcome;
  /** Only ever set from a real lookup response's own account_name field -- never derived,
   * guessed, or carried over from a previous number. */
  accountName?: string | null;
  otpFailureReason?: "invalid" | "expired";
};

export const initialPayoutVerificationState: PayoutVerificationState = {
  phase: "empty",
  phoneMasked: null
};

const KENYAN_MOBILE_PATTERN = /^(?:\+?254|0)7\d{8}$/;

/**
 * A loose shape check only -- it decides whether the "Send code" action is offered, nothing
 * more. The backend's OTP send is the actual proof of control; this just keeps an obviously
 * malformed value from being submitted, and it is not the "final validation mechanism" for
 * which numbers are real Safaricom numbers (that question is exactly what the lookup states
 * above exist to eventually answer, once a real answer exists).
 */
export const isPlausiblePhoneFormat = (value: string): boolean =>
  KENYAN_MOBILE_PATTERN.test(value.replace(/\s+/g, ""));

export type PayoutDestinationResponse = {
  phone_masked: string | null;
  verified: boolean;
  active?: boolean;
};

/** Speculative shape for a future lookup step. Not a real endpoint; only ever produced by a
 * test double or an explicit `lookupDestination` prop, never fetched from tyh-api today. */
export type PayoutLookupResponse = {
  outcome: PayoutLookupOutcome;
  phone_masked: string | null;
  account_name: string | null;
};

export type PayoutVerificationEvent =
  | { type: "PHONE_CHANGED"; value: string }
  | { type: "LOOKUP_STARTED" }
  | { type: "LOOKUP_SUCCEEDED"; result: PayoutLookupResponse }
  | { type: "LOOKUP_FAILED" }
  | { type: "CODE_REQUESTED" }
  | { type: "CODE_SENT"; response: PayoutDestinationResponse }
  | { type: "CODE_REQUEST_FAILED" }
  | { type: "OTP_SUBMITTED" }
  | { type: "OTP_VERIFIED"; response: PayoutDestinationResponse }
  | { type: "OTP_FAILED"; reason: "invalid" | "expired" }
  | { type: "RESET" };

export const payoutVerificationReducer = (
  state: PayoutVerificationState,
  event: PayoutVerificationEvent
): PayoutVerificationState => {
  switch (event.type) {
    case "PHONE_CHANGED": {
      const trimmed = event.value.trim();
      if (!trimmed) {
        return initialPayoutVerificationState;
      }
      return {
        phase: isPlausiblePhoneFormat(event.value) ? "format_valid" : "format_invalid",
        phoneMasked: null
      };
    }
    case "LOOKUP_STARTED":
      return { ...state, phase: "looking_up" };
    case "LOOKUP_SUCCEEDED":
      return {
        phase: "lookup_result",
        phoneMasked: event.result.phone_masked,
        lookupOutcome: event.result.outcome,
        accountName: event.result.account_name
      };
    case "LOOKUP_FAILED":
      return {
        phase: "lookup_result",
        phoneMasked: state.phoneMasked,
        lookupOutcome: "lookup_unavailable",
        accountName: null
      };
    case "CODE_REQUESTED":
      return { ...state, phase: "sending_code" };
    case "CODE_SENT":
      return {
        ...state,
        phase: event.response.verified ? "verified_locked" : "otp_required",
        phoneMasked: event.response.phone_masked
      };
    case "CODE_REQUEST_FAILED":
      return { ...state, phase: "format_valid" };
    case "OTP_SUBMITTED":
      return { ...state, phase: "verifying_code" };
    case "OTP_VERIFIED":
      return { ...state, phase: "verified_locked", phoneMasked: event.response.phone_masked };
    case "OTP_FAILED":
      return { ...state, phase: "otp_failed", otpFailureReason: event.reason };
    case "RESET":
      return initialPayoutVerificationState;
    default:
      return state;
  }
};

/**
 * Best-effort classification of an OTP failure into "expired" vs "invalid" from the backend's
 * own error text -- the same text already shown to the user in a toast elsewhere in this
 * codebase (see FacilityFinancePanel/provider Payments' onError handlers). This does not invent
 * a backend error code; it only picks which of two very similar copy strings to show.
 */
export const classifyOtpFailure = (message: string): "invalid" | "expired" =>
  /expir/i.test(message) ? "expired" : "invalid";
