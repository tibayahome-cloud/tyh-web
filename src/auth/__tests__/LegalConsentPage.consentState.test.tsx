/**
 * LegalConsentGate distinguishes legalConsent === undefined ("no answer yet") from
 * legalConsent === null ("resolved: no consent summary for this account, treat as complete" --
 * see legalConsentIsComplete in schemas/legal.ts). LegalConsentPage had the same old
 * `user?.legalConsent` truthy check in both its bootstrap-triggering effect and its loading
 * guard, plus no attempt latch at all (unlike LegalConsentGate's bootstrapAttemptedRef).
 *
 * This page is reachable with legalConsent already null: a user rehydrated from localStorage
 * always has it as null (never undefined) before any bootstrap runs (see useAuth.tsx's stored
 * user parser), and api.ts dispatches "tiba:legal-consent-required" on any 428 response, which
 * LegalConsentGate's listener uses to navigate here unconditionally, regardless of the client's
 * currently cached legalConsent value.
 *
 * Both this page and LegalConsentGate now share useBoundedBootstrap (src/shared/hooks), so a
 * persistently failing bootstrapMe() gets the same bounded automatic retries and explicit
 * "couldn't verify" UI here as it does on the gate, instead of a permanent spinner.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

vi.mock("../../shared/libs/api", () => ({
  default: { post: vi.fn() }
}));

import { LegalConsentPage } from "../LegalConsentPage";

const renderPageTree = () => (
  <MemoryRouter initialEntries={["/legal/consent"]}>
    <Routes>
      <Route path="/legal/consent" element={<LegalConsentPage />} />
      <Route path="/app" element={<div>app-home</div>} />
      <Route path="/login" element={<div>login-page</div>} />
    </Routes>
  </MemoryRouter>
);

describe("LegalConsentPage consent-state handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates away instead of looping when legalConsent is already null", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [state, setState] = useState<{ isBootstrapping: boolean }>({ isBootstrapping: false });

      // Mirrors mapLegalConsentSummary's contract: a successful call resolves with null when
      // the account genuinely has no consent summary, not undefined.
      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState({ isBootstrapping: true });
        return new Promise<{ legalConsent: null }>((resolve) => setTimeout(resolve, 0)).then(() => {
          setState({ isBootstrapping: false });
          return { legalConsent: null };
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        logout: vi.fn(),
        user: { legalConsent: null }
      });

      return renderPageTree();
    };

    render(<Wrapper />);

    await waitFor(() => expect(screen.getByText("app-home")).toBeInTheDocument());
    // Already-null is a resolved answer: no bootstrap call was needed to determine that.
    expect(bootstrapMeSpy).not.toHaveBeenCalled();
  });

  it("bounds retries and shows an explicit retry UI when bootstrapMe keeps failing, then recovers", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [state, setState] = useState<{ isBootstrapping: boolean; legalConsent: unknown }>({
        isBootstrapping: false,
        legalConsent: undefined
      });
      // A ref, not state: flipping it must not itself trigger the page's navigate-away effect --
      // only an actual bootstrapMe() call (the manual retry) may resolve with real consent data,
      // the same way a real reconnect only helps once the app asks the server again.
      const succeedRef = useRef(false);

      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState((s) => ({ ...s, isBootstrapping: true }));
        return new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => {
          if (succeedRef.current) {
            const consent = { required: true, complete: true, documents: [] };
            setState({ isBootstrapping: false, legalConsent: consent });
            return { legalConsent: consent };
          }
          setState((s) => ({ ...s, isBootstrapping: false }));
          return null;
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        logout: vi.fn(),
        user: { legalConsent: state.legalConsent }
      });

      return (
        <div>
          <button onClick={() => (succeedRef.current = true)}>fix connection</button>
          {renderPageTree()}
        </div>
      );
    };

    render(<Wrapper />);

    // Three bounded automatic attempts (shared MAX_BOOTSTRAP_ATTEMPTS), then the explicit
    // failure UI instead of an indefinite "Loading legal documents" spinner.
    await waitFor(() => expect(bootstrapMeSpy).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/couldn't verify your account\. check your connection/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "fix connection" }));
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("app-home")).toBeInTheDocument());
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(4);
  });

  it("gets a fresh retry budget on remount, as happens after a logout/login cycle", async () => {
    // LegalConsentPage renders <NavigateToLogin/> (a <Navigate to="/login">) when
    // isAuthenticated goes false, which unmounts this component via the router -- unlike
    // LegalConsentGate, which stays mounted for the app's lifetime and has to reset its own
    // ref manually. A subsequent login that lands back on this page mounts a fresh instance
    // with its own fresh useBoundedBootstrap state, so the meaningful guarantee to test is
    // that a new mount is never starved by a previous instance's exhausted attempts.
    const bootstrapMeSpy = vi.fn();
    const bootstrapMe = vi.fn().mockImplementation(() => {
      bootstrapMeSpy();
      return Promise.resolve(null);
    });

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      bootstrapMe,
      logout: vi.fn(),
      user: { legalConsent: undefined }
    });

    const first = render(renderPageTree());
    await waitFor(() => expect(bootstrapMeSpy).toHaveBeenCalledTimes(3));
    first.unmount();

    render(renderPageTree());
    await waitFor(() => expect(bootstrapMeSpy).toHaveBeenCalledTimes(6));
  });

  it("still renders the checklist for a real, incomplete consent summary", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      bootstrapMe: vi.fn().mockResolvedValue(null),
      logout: vi.fn(),
      user: {
        legalConsent: {
          required: true,
          complete: false,
          documents: [
            { type: "terms", version: "v1.0", accepted: false, accepted_at: null },
            { type: "privacy", version: "v1.0", accepted: false, accepted_at: null }
          ]
        }
      }
    });

    render(renderPageTree());

    expect(screen.getByText("Review legal documents")).toBeInTheDocument();
    expect(screen.getByText("I agree to the Terms of Service.")).toBeInTheDocument();
  });

  it("navigates away for a real, complete consent summary", async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      bootstrapMe: vi.fn().mockResolvedValue(null),
      logout: vi.fn(),
      user: { legalConsent: { required: true, complete: true, documents: [] } }
    });

    render(renderPageTree());

    await waitFor(() => expect(screen.getByText("app-home")).toBeInTheDocument());
  });
});
