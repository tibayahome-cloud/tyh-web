/**
 * Behavioral half of the facility-scope consolidation: the shared hook always requests the
 * same, deliberate pageSize (2 -- enough to distinguish 0 / exactly 1 / more than 1 facilities,
 * which is all any consumer actually needs), regardless of which page renders it.
 */

import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchFacilitiesMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args)
}));

import { useAdminFacilityScope } from "../paymentAccess";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useAdminFacilityScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always requests the same deliberate pageSize", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "facility-1" }] });

    const { result } = renderHook(() => useAdminFacilityScope(true), { wrapper });

    await waitFor(() => expect(result.current.facility?.id).toBe("facility-1"));
    expect(fetchFacilitiesMock).toHaveBeenCalledWith({ pageSize: 2 });
  });

  it("resolves exactly one facility to `facility`, and flags anything else as invalid scope", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "facility-1" }, { id: "facility-2" }] });

    const { result } = renderHook(() => useAdminFacilityScope(true), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.facility).toBeNull();
    expect(result.current.hasInvalidScope).toBe(true);
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useAdminFacilityScope(false), { wrapper });
    expect(fetchFacilitiesMock).not.toHaveBeenCalled();
  });
});
