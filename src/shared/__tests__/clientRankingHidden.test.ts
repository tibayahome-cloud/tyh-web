/**
 * "Fastest available" is the only client-facing use of the earliest-slot ranking, and it goes
 * through one shared hook (useFastestFacility) so that no client component asks the API for a
 * ranking itself. Fast-response qualification stays internal: nothing a client or visitor sees
 * may mention it, read its slot counts, or request a ranking directly. This fails if such a
 * reference is added to client-facing code.
 */

import { describe, expect, it } from "vitest";

const CLIENT_FACING = {
  ...import.meta.glob("../../domains/client/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob("../../domains/website/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true })
} as Record<string, string>;

const FORBIDDEN = /available_slot_count|availableSlotCount|earliest_slot|ranking\s*:|fastResponse|fast_response|fast[- ]response/i;

describe("client-facing code keeps internal facility ranking hidden", () => {
  it("scans real client and website sources", () => {
    const files = Object.keys(CLIENT_FACING).filter((file) => !file.includes("__tests__"));
    expect(files.length).toBeGreaterThan(20);
  });

  it("never requests a ranking itself, reads slot counts, or shows a fast-response label", () => {
    const offenders = Object.entries(CLIENT_FACING)
      .filter(([file]) => !file.includes("__tests__"))
      .filter(([, source]) => FORBIDDEN.test(source))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it("keeps the only request for a ranking inside the shared fastest-facility hook", () => {
    const everything = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const requesters = Object.entries(everything)
      .filter(([file]) => !file.includes("__tests__") && !file.includes(".test."))
      .filter(([, source]) => /ranking:\s*"earliest_slot"/.test(source))
      .map(([file]) => file);

    expect(requesters).toEqual(["../hooks/useFastestFacility.ts"]);
  });
});
