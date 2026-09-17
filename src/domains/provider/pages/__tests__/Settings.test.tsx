/**
 * The notification toggles on this page used to be local `useState` only: clicking one flipped
 * the UI instantly but never called the API, so the choice silently reverted on the next reload
 * (or the next `bootstrapMe`). This mirrors the persistence pattern the client Settings page
 * already uses -- `PATCH /users/:id` with `meta_data`, then refresh via `bootstrapMe`.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const showToastMock = vi.fn();
const bootstrapMeMock = vi.fn().mockResolvedValue(null);
const apiPatchMock = vi.fn();

const baseUser = {
  id: "provider-1",
  fullName: "Dr. Provider",
  avatarUrl: null,
  email: "provider@example.com",
  phone: null,
  phoneVerifiedAt: null,
  countryCode: null,
  roles: ["provider"],
  permissions: [],
  meta: {} as Record<string, unknown>,
  legalConsent: null
};

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: baseUser, bootstrapMe: bootstrapMeMock })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: showToastMock, push: vi.fn() })
}));

vi.mock("../../../../shared/libs/api", () => ({
  default: { patch: (...args: unknown[]) => apiPatchMock(...args) },
  api: { patch: (...args: unknown[]) => apiPatchMock(...args) }
}));

vi.mock("../../hooks/useProviderProfile", () => ({
  useProviderProfile: () => ({
    data: { is_available: true, can_emergency: false, daily_request_limit: 5 },
    isLoading: false
  })
}));

vi.mock("../../hooks/useProviderApplication", () => ({
  useProviderApplication: () => ({ data: { status: "approved", items: [] }, isLoading: false })
}));

import ProviderSettings from "../Settings";

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProviderSettings />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("ProviderSettings notification preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPatchMock.mockResolvedValue({ data: {} });
  });

  it("persists a toggle through the users PATCH mutation and refreshes the session", async () => {
    const user = userEvent.setup();
    renderPage();

    const paymentsToggle = await screen.findByRole("button", { name: /payments & wallet/i });
    expect(paymentsToggle).toHaveTextContent("On");

    await user.click(paymentsToggle);

    await waitFor(() =>
      expect(apiPatchMock).toHaveBeenCalledWith(
        "/users/provider-1",
        expect.objectContaining({
          meta_data: { provider_settings: { notifications: expect.objectContaining({ payments: false }) } }
        })
      )
    );
    await waitFor(() => expect(bootstrapMeMock).toHaveBeenCalled());
    expect(paymentsToggle).toHaveTextContent("Off");
  });

  it("reverts the toggle and surfaces an error if the save fails", async () => {
    apiPatchMock.mockRejectedValue(new Error("Network down"));
    const user = userEvent.setup();
    renderPage();

    const bookingToggle = await screen.findByRole("button", { name: /booking updates/i });
    await user.click(bookingToggle);

    await waitFor(() => expect(bookingToggle).toHaveTextContent("On"));
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unable to update notification preference" })
    );
  });
});
