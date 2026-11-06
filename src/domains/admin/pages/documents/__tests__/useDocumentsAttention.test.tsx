/** The menu counts: what needs this admin, and a quiet zero when the answer cannot be had. */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../../../shared/libs/api", () => ({ api: { get: (...args: unknown[]) => state.get(...args) } }));

import { useDocumentsAttention } from "../../../hooks/useDocumentsAttention";

const hook = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useDocumentsAttention(), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  });
};

describe("useDocumentsAttention", () => {
  it("returns what needs the admin", async () => {
    state.get.mockImplementation(async () => ({ data: { data: { providers_waiting: 2, facilities_waiting: 1, facility_sent_back: 0, total: 3 } } }));

    const { result } = hook();

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(state.get).toHaveBeenCalledWith("/documents/attention");
    expect(result.current.data).toEqual({ providers_waiting: 2, facilities_waiting: 1, facility_sent_back: 0, total: 3 });
  });

  it("shows no count rather than an error when the answer cannot be had", async () => {
    state.get.mockImplementation(async () => {
      throw new Error("offline");
    });

    const { result } = hook();

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual({ providers_waiting: 0, facilities_waiting: 0, facility_sent_back: 0, total: 0 });
  });
});
