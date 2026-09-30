/**
 * mapLegalConsentSummary maps a missing/invalid meta.legal_consent to `null`, not to a failed
 * bootstrap (see schemas/legal.ts) -- and legalConsentIsComplete(null) is `true` by design,
 * because plenty of accounts this gate wraps (it wraps /admin/* too, not just /app and /pro)
 * are never given a consent summary at all. The gate used to treat `null` the same as "haven't
 * checked yet" (`!user?.legalConsent`) and spin forever once a real bootstrap resolved that way.
 * These tests lock in the fix, plus a manual-retry-recovers-fully path the other failure tests
 * only check the call count for.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

describe("LegalConsentGate with missing consent metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the protected route once bootstrap resolves a user with legalConsent explicitly null", async () => {
    const Wrapper = () => {
      const [state, setState] = useState<{ isBootstrapping: boolean; legalConsent: unknown }>({
        isBootstrapping: false,
        legalConsent: undefined
      });

      // Mirrors useAuth.tsx: normalized.legalConsent = mapLegalConsentSummary(meta?.legal_consent)
      // runs unconditionally on a successful call, and that function returns null (not
      // undefined) when the field is absent -- this is a resolved answer, not a pending one.
      const bootstrapMe = useCallback(() => {
        setState((s) => ({ ...s, isBootstrapping: true }));
        return new Promise<{ legalConsent: null }>((resolve) => setTimeout(resolve, 0)).then(() => {
          setState({ isBootstrapping: false, legalConsent: null });
          return { legalConsent: null };
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
    expect(screen.queryByText("consent-page")).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn't verify your account/i)).not.toBeInTheDocument();
  });

  it("does not redirect to /legal/consent for a user with no consent summary at all", async () => {
    // A direct (non-bootstrap) render with legalConsent already null, e.g. an admin/ops account
    // rehydrated from a prior session where the server never tracked consent for that role.
    // The gate still re-verifies once via bootstrapMe on mount (it doesn't treat an
    // already-null legalConsent as "no need to check"), so this settles after that microtask
    // rather than on the very first synchronous render.
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      bootstrapMe: vi.fn().mockResolvedValue({ legalConsent: null }),
      user: { legalConsent: null }
    });

    render(renderGateTree());

    await waitFor(() => expect(screen.getByText("settings-page")).toBeInTheDocument());
    expect(screen.queryByText("consent-page")).not.toBeInTheDocument();
  });

  it("fully recovers to the protected route after a manual retry succeeds", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [state, setState] = useState({ isBootstrapping: false, succeed: false });

      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState((s) => ({ ...s, isBootstrapping: true }));
        return new Promise<null>((resolve) => setTimeout(resolve, 0)).then(() => {
          setState((s) => ({ isBootstrapping: false, succeed: s.succeed }));
          // The three automatic attempts all fail; only the manual retry (triggered after
          // `succeed` flips true below) succeeds.
          return null;
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe: state.succeed
          ? vi.fn().mockResolvedValue({ legalConsent: { required: true, complete: true, documents: [] } })
          : bootstrapMe,
        user: {
          legalConsent: state.succeed ? { required: true, complete: true, documents: [] } : undefined
        }
      });

      return (
        <div>
          <button onClick={() => setState((s) => ({ ...s, succeed: true }))}>fix connection</button>
          {renderGateTree()}
        </div>
      );
    };

    render(<Wrapper />);

    await waitFor(() => expect(screen.getByText(/couldn't verify your account/i)).toBeInTheDocument());
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(3);

    // Connection recovers, then the user clicks the gate's own retry button.
    fireEvent.click(screen.getByRole("button", { name: "fix connection" }));
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("settings-page")).toBeInTheDocument());
    expect(screen.queryByText(/couldn't verify your account/i)).not.toBeInTheDocument();
  });
});
