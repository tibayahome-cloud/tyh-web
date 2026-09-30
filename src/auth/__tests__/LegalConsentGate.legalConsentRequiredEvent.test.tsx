/**
 * The backend's contract (app/routes/auth.py): /auth/me always sets
 * meta.legal_consent = consent_summary(user), the exact same function ensure_current_consent()
 * uses to decide whether to raise 428. So a genuinely live 428 can never coexist with
 * legalConsent === null (a missing/malformed meta field) -- a real consent requirement always
 * arrives as a real object with complete:false. But nothing else in the app refetches
 * /auth/me in the background, so user.legalConsent can be STALE ("complete", cached from an
 * earlier bootstrap) at the exact moment a live request 428s because the backend's truth
 * changed since then (a new document published, a consent record reset).
 *
 * LegalConsentGate's "tiba:legal-consent-required" handler now refreshes /auth/me before
 * deciding whether to navigate at all: it only goes to /legal/consent once that refresh
 * confirms consent is genuinely still required, never on a failed refresh (which would only
 * have the stale cached value to navigate with), and it coalesces a burst of simultaneous 428s
 * into a single shared refresh rather than one bootstrapMe() call per event.
 */

import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
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

/** Records every pathname the router renders, so a test can assert a route was never visited,
 * not just that the final DOM happens to match -- a transient bounce through /legal/consent
 * that lands back on the original route by coincidence must still count as a failure. */
const VisitedPathsSpy = ({ onVisit }: { onVisit: (pathname: string) => void }) => {
  const location = useLocation();
  useEffect(() => {
    onVisit(location.pathname);
  }, [location.pathname, onVisit]);
  return null;
};

const renderApp = (onVisit: (pathname: string) => void = () => {}) => (
  <MemoryRouter initialEntries={["/pro/bookings"]}>
    <VisitedPathsSpy onVisit={onVisit} />
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

    // Stays on bookings-page until the refresh actually confirms the requirement -- only then
    // does it navigate to the checklist.
    expect(await screen.findByText("Review legal documents")).toBeInTheDocument();
    expect(screen.getByText("I agree to the Terms of Service.")).toBeInTheDocument();
    expect(screen.queryByText("bookings-page")).not.toBeInTheDocument();

    // The refresh happened exactly once (LegalConsentGate's handler); LegalConsentPage's own
    // mount effect must not have added a second, redundant fetch on top of the fresh data.
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);

    // Give any latent retrigger (the bug this guards against) time to play out.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Review legal documents")).toBeInTheDocument();
  });

  it("coalesces a burst of simultaneous 428s into a single shared refresh", async () => {
    // Several requests in flight at once can each independently 428 (e.g. a page that fires
    // three requests on mount, all rejected the same way) -- that must not turn into three
    // separate bootstrapMe() calls, only one shared refresh that every event waits on.
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

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(screen.getByText("Review legal documents")).toBeInTheDocument();
    // Three simultaneous dispatches, one shared refresh.
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);
  });

  it("does not coalesce across separate bursts: a later 428 after the first refresh settles starts its own refresh", async () => {
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
          const fresh = { required: true, complete: true, documents: [] };
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
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new CustomEvent("tiba:legal-consent-required"));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(2);
  });

  it("does not navigate using stale consent when the /auth/me refresh fails, and does not retry unboundedly", async () => {
    // bootstrapMe() swallows its own request errors and resolves null rather than rejecting
    // (see useAuth.tsx) -- a failed refresh must leave the user on the page they were on,
    // never bounce them to /legal/consent using the stale cached value.
    const bootstrapMeSpy = vi.fn();
    const visitedPaths: string[] = [];

    const Wrapper = () => {
      const [state, setState] = useState({ isBootstrapping: false });

      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState({ isBootstrapping: true });
        return new Promise<null>((resolve) => setTimeout(resolve, 0)).then(() => {
          setState({ isBootstrapping: false });
          return null;
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        logout: vi.fn(),
        // Stale-complete: the same state a 428 can legitimately fire against.
        user: { legalConsent: { required: true, complete: true, documents: [] } }
      });

      return renderApp((pathname) => visitedPaths.push(pathname));
    };

    render(<Wrapper />);

    act(() => {
      window.dispatchEvent(new CustomEvent("tiba:legal-consent-required"));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);

    // No navigation happened: still on the original route, not bounced to the checklist using
    // the stale "complete" value -- and /legal/consent was never even transiently visited (not
    // just "the final DOM happens to match").
    expect(screen.getByText("bookings-page")).toBeInTheDocument();
    expect(screen.queryByText("Review legal documents")).not.toBeInTheDocument();
    expect(visitedPaths).not.toContain("/legal/consent");

    // No further, unbounded retry of the failed refresh on its own.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("bookings-page")).toBeInTheDocument();
  });
});
