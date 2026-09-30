/**
 * bootstrapMe() can resolve without ever populating legalConsent (a user record missing that
 * metadata server-side). isBootstrapping still flips false -> true -> false around the call,
 * and that flip alone used to re-run the effect and fire bootstrapMe() again -- forever, since
 * each call's own isBootstrapping flip retriggered the next one, and nothing else in the guard
 * ever changed. This mimics that real isBootstrapping cycle and proves it settles after one call.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

import { LegalConsentGate } from "../LegalConsentGate";

describe("LegalConsentGate bootstrap retry guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls bootstrapMe only once when legalConsent metadata never arrives", async () => {
    const bootstrapMeSpy = vi.fn();

    const Wrapper = () => {
      const [state, setState] = useState<{ isBootstrapping: boolean; legalConsent: unknown }>({
        isBootstrapping: false,
        legalConsent: undefined
      });

      // Mirrors the real useAuth hook: isBootstrapping flips true then false around the call,
      // and the call resolves with a real (truthy) user -- just one whose legalConsent metadata
      // never showed up. A falsy/null result means the request itself failed, which is a
      // different scenario (see LegalConsentGate.bootstrapFailure.test.tsx).
      const bootstrapMe = useCallback(() => {
        bootstrapMeSpy();
        setState((s) => ({ ...s, isBootstrapping: true }));
        return new Promise<{ legalConsent: undefined }>((resolve) => setTimeout(resolve, 0)).then(() => {
          setState((s) => ({ ...s, isBootstrapping: false }));
          return { legalConsent: undefined };
        });
      }, []);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: state.isBootstrapping,
        bootstrapMe,
        user: { legalConsent: state.legalConsent }
      });

      return (
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
    };

    render(<Wrapper />);

    await waitFor(() => expect(bootstrapMeSpy).toHaveBeenCalledTimes(1));

    // Give the isBootstrapping false -> true -> false cycle -- and any further retrigger a
    // buggy guard would cause -- time to play out.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByText("Checking account requirements")).toBeInTheDocument();
    expect(bootstrapMeSpy).toHaveBeenCalledTimes(1);
  });
});
