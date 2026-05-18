import { useState, useEffect } from "react";
import type { ReactNode } from "react";

import { useAuth } from "../shared/hooks/useAuth";
import { PhoneVerificationPrompt } from "../shared/components/PhoneVerificationPrompt";

type PhoneVerificationGateProps = {
  children: ReactNode;
};

const DISMISSED_KEY = "tiba.phone_verification_dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const PhoneVerificationGate = ({ children }: PhoneVerificationGateProps) => {
  const { user, isAuthenticated } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
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
  }, [isAuthenticated, user]);

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
