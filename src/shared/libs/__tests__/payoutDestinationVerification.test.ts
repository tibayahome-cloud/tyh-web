/**
 * Payout-destination verification state machine.
 *
 * These cover the ten states the product asked for: format-valid entry, in-progress
 * verification, a confirmed Safaricom number, an unsupported operator, a returned account name
 * ready for confirmation, a verified number with no name available, the lookup service being
 * unavailable, OTP required, OTP failed/expired, and a locked, verified destination. The lookup
 * states are speculative (no such endpoint exists in tyh-api today per 2026-09-17 confirmation)
 * and only ever appear behind MPESA_DESTINATION_LOOKUP_ENABLED with an explicit lookup function
 * supplied -- this file tests the reducer directly, so it never depends on that flag itself.
 */

import { describe, expect, it } from "vitest";

import {
  classifyOtpFailure,
  initialPayoutVerificationState,
  isPlausiblePhoneFormat,
  payoutVerificationReducer,
  type PayoutVerificationState
} from "../payoutDestinationVerification";

describe("isPlausiblePhoneFormat", () => {
  it("accepts Kenyan mobile numbers in common formats", () => {
    expect(isPlausiblePhoneFormat("0712345678")).toBe(true);
    expect(isPlausiblePhoneFormat("+254712345678")).toBe(true);
    expect(isPlausiblePhoneFormat("254712345678")).toBe(true);
    expect(isPlausiblePhoneFormat("0722 345 678")).toBe(true);
  });

  it("rejects obviously malformed input without claiming to validate carrier", () => {
    expect(isPlausiblePhoneFormat("")).toBe(false);
    expect(isPlausiblePhoneFormat("123")).toBe(false);
    expect(isPlausiblePhoneFormat("not a number")).toBe(false);
    expect(isPlausiblePhoneFormat("0812345678")).toBe(false); // not a 07 mobile prefix shape
  });
});

describe("payoutVerificationReducer", () => {
  // 1. number entered and format-valid
  it("moves to format_valid once the number looks like a real mobile number", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "PHONE_CHANGED",
      value: "0712345678"
    });
    expect(state.phase).toBe("format_valid");
  });

  it("moves to format_invalid for a malformed number, and back to empty when cleared", () => {
    const invalid = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "PHONE_CHANGED",
      value: "123"
    });
    expect(invalid.phase).toBe("format_invalid");

    const cleared = payoutVerificationReducer(invalid, { type: "PHONE_CHANGED", value: "" });
    expect(cleared).toEqual(initialPayoutVerificationState);
  });

  // 2. verification in progress
  it("has distinct in-progress phases for lookup, code request, and code verification", () => {
    const looking = payoutVerificationReducer(initialPayoutVerificationState, { type: "LOOKUP_STARTED" });
    expect(looking.phase).toBe("looking_up");

    const sending = payoutVerificationReducer(initialPayoutVerificationState, { type: "CODE_REQUESTED" });
    expect(sending.phase).toBe("sending_code");

    const verifying = payoutVerificationReducer(initialPayoutVerificationState, { type: "OTP_SUBMITTED" });
    expect(verifying.phase).toBe("verifying_code");
  });

  // 3. Safaricom number confirmed
  it("carries a verified_safaricom lookup outcome through to state", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "LOOKUP_SUCCEEDED",
      result: { outcome: "verified_safaricom", phone_masked: "07** ***123", account_name: null }
    });
    expect(state.phase).toBe("lookup_result");
    expect(state.lookupOutcome).toBe("verified_safaricom");
  });

  // 4. unsupported operator
  it("carries an unsupported_network lookup outcome through to state", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "LOOKUP_SUCCEEDED",
      result: { outcome: "unsupported_network", phone_masked: "07** ***123", account_name: null }
    });
    expect(state.lookupOutcome).toBe("unsupported_network");
  });

  // 5. name returned and ready for confirmation
  it("carries a returned account name through to state, never inventing one", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "LOOKUP_SUCCEEDED",
      result: { outcome: "name_verified", phone_masked: "07** ***123", account_name: "Willis Raburu" }
    });
    expect(state.lookupOutcome).toBe("name_verified");
    expect(state.accountName).toBe("Willis Raburu");
  });

  // 6. name unavailable but number/network verified
  it("keeps accountName null when the network is verified but no name is available", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "LOOKUP_SUCCEEDED",
      result: { outcome: "name_unavailable", phone_masked: "07** ***123", account_name: null }
    });
    expect(state.lookupOutcome).toBe("name_unavailable");
    expect(state.accountName).toBeNull();
  });

  // 7. verification service unavailable
  it("falls back to lookup_unavailable when the lookup call itself fails", () => {
    const priorState: PayoutVerificationState = { phase: "looking_up", phoneMasked: null };
    const state = payoutVerificationReducer(priorState, { type: "LOOKUP_FAILED" });
    expect(state.phase).toBe("lookup_result");
    expect(state.lookupOutcome).toBe("lookup_unavailable");
    expect(state.accountName).toBeNull();
  });

  // 8. OTP required
  it("moves to otp_required once a code is sent to an unverified number", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "CODE_SENT",
      response: { phone_masked: "07** ***123", verified: false }
    });
    expect(state.phase).toBe("otp_required");
    expect(state.phoneMasked).toBe("07** ***123");
  });

  it("skips straight to verified_locked when the backend reports the number already verified", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "CODE_SENT",
      response: { phone_masked: "07** ***123", verified: true }
    });
    expect(state.phase).toBe("verified_locked");
  });

  // 9. OTP failed or expired
  it("distinguishes an invalid code from an expired one", () => {
    const invalid = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "OTP_FAILED",
      reason: "invalid"
    });
    expect(invalid.phase).toBe("otp_failed");
    expect(invalid.otpFailureReason).toBe("invalid");

    const expired = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "OTP_FAILED",
      reason: "expired"
    });
    expect(expired.otpFailureReason).toBe("expired");
  });

  it("classifies OTP failure reason from the backend's own error text", () => {
    expect(classifyOtpFailure("The code you entered is incorrect")).toBe("invalid");
    expect(classifyOtpFailure("This code has expired")).toBe("expired");
    expect(classifyOtpFailure("Code expired, request a new one")).toBe("expired");
  });

  // 10. destination verified and locked to the withdrawal
  it("reaches verified_locked after a successful OTP verification", () => {
    const state = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "OTP_VERIFIED",
      response: { phone_masked: "07** ***123", verified: true }
    });
    expect(state.phase).toBe("verified_locked");
    expect(state.phoneMasked).toBe("07** ***123");
  });

  it("resets cleanly back to the initial state", () => {
    const verified = payoutVerificationReducer(initialPayoutVerificationState, {
      type: "OTP_VERIFIED",
      response: { phone_masked: "07** ***123", verified: true }
    });
    expect(payoutVerificationReducer(verified, { type: "RESET" })).toEqual(initialPayoutVerificationState);
  });
});
