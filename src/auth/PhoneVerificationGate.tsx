import { useState, useEffect } from "react";
import type { ReactNode } from "react";

import { useAuth } from "../shared/hooks/useAuth";
import { PhoneVerificationPrompt } from "../shared/components/PhoneVerificationPrompt";
import { useBookedAtLoad } from "./useBookedAtLoad";

type PhoneVerificationGateProps = {
  children: ReactNode;
  /**
   * When to ask. By default straight away, which is what providers get. A client is asked only after their first
   * booking: confirming a phone number is not needed to book, and putting it on their first screen is one more thing
   * between a new person and their appointment.
   */
  after?: "first-booking";
};

const DISMISSED_KEY = "tiba.phone_verification_dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const PhoneVerificationGateCore = ({ children, ready }: { children: ReactNode; ready: boolean }) => {
  const { user, isAuthenticated } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setShowPrompt(false);
      return;
    }

    // Not time to ask yet (a client who has not booked)
    if (!ready) {
      setShowPrompt(false);
      return;
    }

    // If phone is already verified, don't show prompt
    if (user.phoneVerifiedAt) {
      setShowPrompt(false);
      return;
    }

    // If user doesn't have a phone number, don't show prompt
    if (!user.phone) {
      setShowPrompt(false);
      return;
    }

    // Check if user has recently dismissed the prompt
    try {
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt, 10);
        if (Date.now() - dismissedTime < DISMISS_DURATION_MS) {
          setShowPrompt(false);
          return;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    // Show prompt after a short delay to not interrupt page load
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, ready]);

  const handleClose = () => {
    setShowPrompt(false);
    // Store dismissal time so we don't show again for 24 hours
    try {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleVerified = () => {
    setShowPrompt(false);
    // Clear the dismissed key since verification is complete
    try {
      localStorage.removeItem(DISMISSED_KEY);
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <>
      {children}
      <PhoneVerificationPrompt
        open={showPrompt}
        onClose={handleClose}
        onVerified={handleVerified}
      />
    </>
  );
};

// Kept apart so that only the client app asks for a person's bookings: the provider app does not need them, and the
// hook needs the query client the client app has.
const PhoneVerificationGateAfterFirstBooking = ({ children }: { children: ReactNode }) => {
  const bookedAtLoad = useBookedAtLoad();
  return <PhoneVerificationGateCore ready={bookedAtLoad}>{children}</PhoneVerificationGateCore>;
};

export const PhoneVerificationGate = ({ children, after }: PhoneVerificationGateProps) =>
  after === "first-booking" ? (
    <PhoneVerificationGateAfterFirstBooking>{children}</PhoneVerificationGateAfterFirstBooking>
  ) : (
    <PhoneVerificationGateCore ready>{children}</PhoneVerificationGateCore>
  );
