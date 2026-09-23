/**
 * bootstrapMe() swallows its own request errors and resolves `null` instead of rejecting (see
 * useAuth.tsx bootstrapMe's try/catch), so a transient /auth/me failure looks like a falsy
 * result to LegalConsentGate -- the same shape a genuinely missing-consent success used to
 * produce before this file distinguished them. Without a bounded retry, one bad network blip
 * would leave a real user stuck on "Checking account requirements" forever with no way out.
 * These tests cover: a transient failure that recovers within the retry budget, one that
 * exhausts it and surfaces a manual retry, a normal successful bootstrap, and the retry
 * counters resetting across a logout/login cycle.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

import { LegalConsentGate } from "../LegalConsentGate";

const renderGateTree = () => (
  <MemoryRouter initialEntries={["/pro/settings"]}>
    <Routes>
      <Route
        path="/pro/settings"
        element={
          <LegalConsentGate>
            <div>settings-page</div>
          </LegalConsentGate>
        }
      />
      <Route path="/legal/consent" element={<div>consent-page</div>} />
    </Routes>
  </MemoryRouter>
);

describe("LegalConsentGate bootstrap outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the protected route immediately on a normal successful bootstrap", async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      bootstrapMe: vi.fn().mockResolvedValue({ legalConsent: { required: true, complete: true, documents: [] } }),
      user: { legalConsent: { required: true, complete: true, documents: [] } }
    });

    render(renderGateTree());

    expect(screen.getByText("settings-page")).toBeInTheDocument();
  });

  it("recovers from a transient failure within the retry budget without surfacing an error", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [state, setState] = useState<{
        isBootstrapping: boolean;
        legalConsent: unknown;
        attempt: number;
      }>({ isBootstrapping: false, legalConsent: undefined, attempt: 0 });

      // Fails (resolves null, mirroring a swallowed network error) on the first call, then
      // succeeds with real consent data on the second -- well within MAX_BOOTSTRAP_ATTEMPTS.
      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState((s) => ({ ...s, isBootstrapping: true }));
        return new Promise<{ legalConsent: unknown } | null>((resolve) => setTimeout(resolve, 0)).then(() => {
          setState((s) => {
            const attempt = s.attempt + 1;
            const succeeded = attempt >= 2;
            return {
              isBootstrapping: false,
              attempt,
              legalConsent: succeeded ? { required: true, complete: true, documents: [] } : undefined
            };
          });
          return null;
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        user: { legalConsent: state.legalConsent }
      });

      return renderGateTree();
    };

    render(<Wrapper />);

    await waitFor(() => expect(screen.getByText("settings-page")).toBeInTheDocument());
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/couldn't verify your account/i)).not.toBeInTheDocument();
  });

  it("stops retrying and shows a manual retry option once the failure budget is exhausted", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [state, setState] = useState({ isBootstrapping: false });

      // Always fails (resolves null), simulating a persistent outage.
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
        user: { legalConsent: undefined }
      });

      return renderGateTree();
    };

    render(<Wrapper />);

    await waitFor(() => expect(screen.getByText(/couldn't verify your account/i)).toBeInTheDocument());
    // 3 automatic attempts, then it stops and asks the user to retry manually.
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(3);

    // Give it more time -- a fixed budget must not keep retrying on its own afterward.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(bootstrapMeSpy).toHaveBeenCalledTimes(4));
  });

  it("resets the retry budget across a logout/login cycle instead of carrying over exhaustion", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [authed, setAuthed] = useState(true);
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
        isAuthenticated: authed,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        user: { legalConsent: undefined }
      });

      return (
        <div>
          <button onClick={() => setAuthed(false)}>log out</button>
          <button onClick={() => setAuthed(true)}>log in</button>
          {renderGateTree()}
        </div>
      );
    };

    render(<Wrapper />);

    await waitFor(() => expect(bootstrapMeSpy).toHaveBeenCalledTimes(3), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText(/couldn't verify your account/i)).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: "log out" }));
    fireEvent.click(screen.getByRole("button", { name: "log in" }));

    // A fresh session gets a fresh budget: 3 more attempts, not "already exhausted."
    await waitFor(() => expect(bootstrapMeSpy).toHaveBeenCalledTimes(6), { timeout: 3000 });
    expect(screen.getByText(/couldn't verify your account/i)).toBeInTheDocument();
  });
});
