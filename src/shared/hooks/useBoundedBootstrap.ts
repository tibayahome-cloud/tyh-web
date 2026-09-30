import { useEffect, useRef, useState } from "react";

import { useAuth } from "./useAuth";

// useAuth's bootstrapMe() swallows its own request errors and resolves `null` rather than
// rejecting (see useAuth.tsx), so a transient /auth/me failure and "call succeeded but the
// server just never populated a field this screen needs" both show up here the same way: a
// falsy result. A null result gets a bounded number of automatic retries; if those are all
// exhausted, callers get an explicit failed state instead of checking forever.
//
// Shared by LegalConsentGate and LegalConsentPage -- both screens gate on the same
// user.legalConsent bootstrap and need identical bounded-retry behavior. Keeping the mechanism
// here means a future fix (or a third consumer) only has to touch one place.
const MAX_BOOTSTRAP_ATTEMPTS = 3;

export const useBoundedBootstrap = () => {
  const auth = useAuth();
  const { user, isAuthenticated, isBootstrapping, bootstrapMe } = auth;
  const [checking, setChecking] = useState(false);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  // Bumped to explicitly re-run the effect for a retry, instead of relying on the
  // isBootstrapping flip bootstrapMe's own call causes -- that flip races against this effect's
  // own promise-chain callback (whichever lands relative to it), so it is not a reliable way to
  // schedule a follow-up attempt.
  const [retryTick, setRetryTick] = useState(0);
  // /auth/me can resolve without ever populating legalConsent. isBootstrapping flips back to
  // false either way, which re-runs this effect -- without this guard that meant an unbounded
  // retry loop of bootstrapMe() calls whenever the metadata stayed missing.
  const bootstrapAttemptedRef = useRef(false);
  const attemptCountRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) {
      bootstrapAttemptedRef.current = false;
      attemptCountRef.current = 0;
      setBootstrapFailed(false);
      return;
    }

    // legalConsent is `undefined` until a bootstrap settles and `null` afterward if the account
    // genuinely has no consent summary (mapLegalConsentSummary maps a missing/invalid
    // meta.legal_consent to null, not to a failed request -- see schemas/legal.ts). Only
    // `undefined` means "we don't have an answer yet"; treating null the same way meant
    // bootstrapMe was called again even though the answer had already arrived.
    if (isBootstrapping || user?.legalConsent !== undefined || bootstrapAttemptedRef.current) {
      return;
    }

    bootstrapAttemptedRef.current = true;
    setChecking(true);
    bootstrapMe()
      .then((result) => {
        if (result) {
          // A real user came back, even if it still lacks legalConsent -- that's a data
          // issue, not a failure, and retrying can't fix it. Stop here (guard stays set).
          attemptCountRef.current = 0;
          return;
        }

        attemptCountRef.current += 1;
        if (attemptCountRef.current < MAX_BOOTSTRAP_ATTEMPTS) {
          bootstrapAttemptedRef.current = false;
          setRetryTick((tick) => tick + 1);
        } else {
          setBootstrapFailed(true);
        }
      })
      .finally(() => setChecking(false));
  }, [bootstrapMe, isAuthenticated, isBootstrapping, user?.legalConsent, retryTick]);

  const retryBootstrap = () => {
    attemptCountRef.current = 0;
    bootstrapAttemptedRef.current = true;
    setBootstrapFailed(false);
    setChecking(true);
    bootstrapMe()
      .then((result) => {
        if (!result) {
          setBootstrapFailed(true);
        }
      })
      .finally(() => setChecking(false));
  };

  return { ...auth, checking, bootstrapFailed, retryBootstrap };
};
