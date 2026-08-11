import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

import { LegalConsentGate } from "../LegalConsentGate";

const renderGate = () =>
  render(
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

describe("LegalConsentGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the protected route once consent is already complete", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      bootstrapMe: vi.fn().mockResolvedValue(null),
      user: { legalConsent: { required: true, complete: true, documents: [] } }
    });

    renderGate();

    expect(screen.getByText("settings-page")).toBeInTheDocument();
  });

  it("redirects to /legal/consent when a current document has not been accepted", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      bootstrapMe: vi.fn().mockResolvedValue(null),
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

    renderGate();

    expect(screen.queryByText("settings-page")).not.toBeInTheDocument();
    expect(screen.getByText("consent-page")).toBeInTheDocument();
  });

  it("redirects once bootstrapMe resolves an incomplete summary, mirroring real post-login timing", async () => {
    // Right after login, loginClientProvider sets `user` from the login response
    // directly (mapUserResource never populates legalConsent), so this field
    // starts undefined and only becomes known once bootstrapMe's /auth/me call
    // resolves. This test exercises that transition instead of assuming the
    // data is already present on first render.
    const Wrapper = () => {
      const [legalConsent, setLegalConsent] = useState<unknown>(undefined);

      useAuthMock.mockReturnValue({
        isAuthenticated: true,
        isBootstrapping: false,
        bootstrapMe: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          setLegalConsent({
            required: true,
            complete: false,
            documents: [{ type: "terms", version: "v1.0", accepted: false, accepted_at: null }]
          });
          return null;
        }),
        user: { legalConsent }
      });

      return renderGateTree();
    };

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

    render(<Wrapper />);

    expect(screen.queryByText("settings-page")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("consent-page")).toBeInTheDocument());
  });
});
