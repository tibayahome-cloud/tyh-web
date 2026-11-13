import { afterEach, describe, expect, it, vi } from "vitest";

import { describePlace } from "../geocoding";

const withGoogle = (geocode: (request: unknown) => Promise<{ results: unknown[] }>) => {
  (globalThis as { google?: unknown }).google = { maps: { Geocoder: class { geocode = geocode; } } };
};

afterEach(() => {
  delete (globalThis as { google?: unknown }).google;
  vi.unstubAllGlobals();
});

const POINT = { lat: -1.2921, lng: 36.8219 };

describe("describePlace", () => {
  it("names the building or house, not just the ward, drops the country, and returns the plus code", async () => {
    withGoogle(async () => ({
      results: [
        { types: ["plus_code"], formatted_address: "7GRP+J3 Nairobi, Kenya", plus_code: { compound_code: "7GRP+J3 Nairobi, Kenya" } },
        { types: ["sublocality", "political"], formatted_address: "Starehe, Nairobi, Kenya" },
        { types: ["street_address"], formatted_address: "Plot 12, Argwings Kodhek Rd, Nairobi, Kenya" }
      ]
    }));

    expect(await describePlace(POINT)).toEqual({ address: "Plot 12, Argwings Kodhek Rd, Nairobi", plusCode: "7GRP+J3 Nairobi" });
  });

  it("falls back to the street when there is no building, and to the first answer when there is no street", async () => {
    withGoogle(async () => ({
      results: [
        { types: ["sublocality"], formatted_address: "Starehe, Nairobi, Kenya" },
        { types: ["route"], formatted_address: "Haile Selassie Ave, Nairobi, Kenya" }
      ]
    }));
    expect((await describePlace(POINT))?.address).toBe("Haile Selassie Ave, Nairobi");

    withGoogle(async () => ({ results: [{ types: ["sublocality"], formatted_address: "Starehe, Nairobi, Kenya" }] }));
    expect((await describePlace(POINT))?.address).toBe("Starehe, Nairobi");
  });

  it("does not show a leading plus code as if it were an address", async () => {
    withGoogle(async () => ({ results: [{ types: ["establishment"], formatted_address: "7GRP+J3 Nairobi, Kenya" }] }));
    expect((await describePlace(POINT))?.address).toBe("Nairobi");
  });

  it("asks OpenStreetMap when Google fails, and keeps just the street, area and town", async () => {
    withGoogle(async () => {
      throw new Error("billing");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          address: { road: "Argwings Kodhek Road", suburb: "Kilimani", city: "Nairobi", state: "Nairobi County" },
          display_name: "Argwings Kodhek Road, Kilimani, Nairobi, Nairobi County, 00100, Kenya"
        })
      }))
    );

    expect(await describePlace(POINT)).toEqual({ address: "Argwings Kodhek Road, Kilimani, Nairobi", plusCode: null });
  });

  it("is null when nothing answers, and never returns coordinates as the address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await describePlace(POINT)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ display_name: "-1.2921, 36.8219" }) })));
    expect(await describePlace(POINT)).toBeNull();
  });
});
