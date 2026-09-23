/**
 * The backend's contract (app/routes/auth.py): /auth/me always sets
 * meta.legal_consent = consent_summary(user), the exact same function ensure_current_consent()
 * uses to decide whether to raise 428. So a genuinely live 428 can never coexist with
 * legalConsent === null (a missing/malformed meta field) -- a real consent requirement always
 * arrives as a real object with complete:false. But nothing else in the app refetches
 * /auth/me in the background, so user.legalConsent can be STALE ("complete", cached from an
 * earlier bootstrap) at the exact moment a live request 428s because the backend's truth
 * changed since then (a new document published, a consent record reset). Before this fix,
 * LegalConsentGate's "tiba:legal-consent-required" handler navigated to /legal/consent without
 * refreshing first, so LegalConsentPage's own "already complete" effect fired against the
 * stale cached value and bounced straight back to the page that just 428'd -- this test
 * reproduces that exact round trip and proves it settles on /legal/consent instead of looping.
 */

import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

vi.mock("../../shared/libs/api", () => ({
  default: { post: vi.fn() }
}));

import { LegalConsentGate } from "../LegalConsentGate";
import { LegalConsentPage } from "../LegalConsentPage";

const renderApp = () => (
  <MemoryRouter initialEntries={["/pro/bookings"]}>
    <Routes>
      <Route
        path="/pro/bookings"
        element={
          <LegalConsentGate>
            <div>bookings-page</div>
          </LegalConsentGate>
        }
      />
      <Route path="/legal/consent" element={<LegalConsentPage />} />
    </Routes>
  </MemoryRouter>
);

describe("428 legal-consent-required event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not loop between the original route and /legal/consent when the cached consent was stale", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      // Starts "complete" -- fetched at an earlier login, before the backend's actual
      // requirement changed. This is exactly the state a 428 can fire against.
      const [state, setState] = useState<{ isBootstrapping: boolean; legalConsent: unknown }>({
        isBootstrapping: false,
        legalConsent: { required: true, complete: true, documents: [] }
      });

      // The re-fetch triggered by the 428 handler returns the server's current truth: still
      // required, still incomplete -- the same consent_summary() the backend used to 428.
      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState((s) => ({ ...s, isBootstrapping: true }));
        return new Promise<{ legalConsent: unknown }>((resolve) => setTimeout(resolve, 0)).then(() => {
          const fresh = {
            required: true,
            complete: false,
            documents: [{ type: "terms", version: "v1.0", accepted: false, accepted_at: null }]
          };
          setState({ isBootstrapping: false, legalConsent: fresh });
          return { legalConsent: fresh };
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        logout: vi.fn(),
        user: { legalConsent: state.legalConsent }
      });

      return renderApp();
    };

    render(<Wrapper />);

    expect(screen.getByText("bookings-page")).toBeInTheDocument();

    // The api.ts response interceptor dispatches this on any live 428.
    act(() => {
      window.dispatchEvent(new CustomEvent("tiba:legal-consent-required"));
    });

    // Settles on the consent checklist -- not bounced straight back to bookings-page, and not
    // stuck loading forever either.
    expect(await screen.findByText("Review legal documents")).toBeInTheDocument();
    expect(screen.getByText("I agree to the Terms of Service.")).toBeInTheDocument();
    expect(screen.queryByText("bookings-page")).not.toBeInTheDocument();

    // The refresh happened exactly once (LegalConsentGate's handler); LegalConsentPage's own
    // mount effect must not have added a second, redundant fetch on top of the fresh data.
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);

    // Give any latent retrigger (the bug this guards against) time to play out.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Review legal documents")).toBeInTheDocument();
  });

  it("stays bounded even if the 428 event fires more than once in quick succession", async () => {
    // Several parallel requests can each independently 428 and each dispatch the event -- the
    // refresh/navigate pair must not compound into extra bootstrap calls or extra bounces.
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [state, setState] = useState<{ isBootstrapping: boolean; legalConsent: unknown }>({
        isBootstrapping: false,
        legalConsent: { required: true, complete: true, documents: [] }
      });

      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState((s) => ({ ...s, isBootstrapping: true }));
        return new Promise<{ legalConsent: unknown }>((resolve) => setTimeout(resolve, 0)).then(() => {
          const fresh = {
            required: true,
            complete: false,
            documents: [{ type: "terms", version: "v1.0", accepted: false, accepted_at: null }]
          };
          setState({ isBootstrapping: false, legalConsent: fresh });
          return { legalConsent: fresh };
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        logout: vi.fn(),
        user: { legalConsent: state.legalConsent }
      });

      return renderApp();
    };

    render(<Wrapper />);

    act(() => {
      window.dispatchEvent(new CustomEvent("tiba:legal-consent-required"));
      window.dispatchEvent(new CustomEvent("tiba:legal-consent-required"));
      window.dispatchEvent(new CustomEvent("tiba:legal-consent-required"));
    });

    expect(await screen.findByText("Review legal documents")).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByText("Review legal documents")).toBeInTheDocument();
    // Three dispatches, three refreshes -- bounded by the number of events, not unbounded.
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(3);
  });
});
