import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { api } from "../../../../shared/libs/api";
import { providerFinancialsAreVisible, type ProviderProfile, useUpdateProviderStatus } from "../useProviderProfile";

vi.mock("../../../../shared/libs/api", () => ({
  api: { patch: vi.fn() }
}));

const makeProfile = (visible: boolean | null | undefined): ProviderProfile => ({
  id: "provider-1",
  user_id: "user-1",
  facility_id: "facility-1",
  verified: true,
  is_available: true,
  daily_request_limit: 10,
  can_emergency: false,
  facility: {
    id: "facility-1",
    name: "Nairobi Clinic",
    provider_financials_visible: visible
  }
});

describe("providerFinancialsAreVisible", () => {
  it("hides provider financials when the facility disables visibility", () => {
    expect(providerFinancialsAreVisible(makeProfile(false))).toBe(false);
  });

  it("keeps provider financials visible when no facility restriction exists", () => {
    expect(providerFinancialsAreVisible(makeProfile(true))).toBe(true);
    expect(providerFinancialsAreVisible(makeProfile(null))).toBe(true);
    expect(providerFinancialsAreVisible(undefined)).toBe(true);
  });
});

describe("useUpdateProviderStatus", () => {
  it("updates the cached status before the API request resolves", async () => {
    const client = new QueryClient();
    const profile = makeProfile(true);
    client.setQueryData(["provider", "profile", "user-1"], profile);
    let resolvePatch!: () => void;
    vi.mocked(api.patch).mockImplementationOnce(
      () => new Promise((resolve) => { resolvePatch = () => resolve({ data: {} }); })
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateProviderStatus("user-1"), { wrapper });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => {
      expect(client.getQueryData<ProviderProfile>(["provider", "profile", "user-1"])?.is_available).toBe(false);
    });
    expect(api.patch).toHaveBeenCalledWith("/providers/user-1", { is_available: false });

    await act(async () => {
      resolvePatch();
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
