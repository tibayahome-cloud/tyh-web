import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { blackoutsQueryKey, removeBlackoutFromCache } from "../blackoutCache";

describe("removeBlackoutFromCache", () => {
  it("drops only the deleted blackout from the cached list right away", () => {
    const client = new QueryClient();
    client.setQueryData(blackoutsQueryKey("u1"), [{ id: "a" }, { id: "b" }, { id: "c" }]);

    removeBlackoutFromCache(client, "u1", "b");

    expect(client.getQueryData(blackoutsQueryKey("u1"))).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("refreshes in the background after updating the cache", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    client.setQueryData(blackoutsQueryKey("u1"), [{ id: "a" }]);

    removeBlackoutFromCache(client, "u1", "a");

    expect(invalidate).toHaveBeenCalledWith({ queryKey: blackoutsQueryKey("u1") });
  });

  it("leaves other providers' caches and an empty cache alone", () => {
    const client = new QueryClient();
    client.setQueryData(blackoutsQueryKey("other"), [{ id: "a" }]);

    removeBlackoutFromCache(client, "u1", "a");

    expect(client.getQueryData(blackoutsQueryKey("u1"))).toBeUndefined();
    expect(client.getQueryData(blackoutsQueryKey("other"))).toEqual([{ id: "a" }]);
  });
});
