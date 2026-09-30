/**
 * Earliest-slot ranking and fast-response qualification are internal while they are benchmarked.
 * Nothing a client or a visitor sees may ask for the ranking, read its data, or mention either,
 * so this fails if such a reference is added to client-facing code.
 */

import { describe, expect, it } from "vitest";

const CLIENT_FACING = {
  ...import.meta.glob("../../domains/client/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob("../../domains/website/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true })
} as Record<string, string>;

const FORBIDDEN = /earliestAvailableAt|earliest_available_at|availableSlotCount|available_slot_count|earliest_slot|ranking\s*:|fastResponse|fast_response|fast[- ]response/i;

describe("client-facing code keeps internal facility ranking hidden", () => {
  it("scans real client and website sources", () => {
    const files = Object.keys(CLIENT_FACING).filter((file) => !file.includes("__tests__"));
    expect(files.length).toBeGreaterThan(20);
  });

  it("never requests the ranking, reads its fields, or shows a fast-response label", () => {
    const offenders = Object.entries(CLIENT_FACING)
      .filter(([file]) => !file.includes("__tests__"))
      .filter(([, source]) => FORBIDDEN.test(source))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});
