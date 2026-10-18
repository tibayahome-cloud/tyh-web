import { describe, expect, it } from "vitest";

import { defaultServiceKind, splitServicesByKind } from "../facilityServiceKinds";

describe("splitServicesByKind", () => {
  const services = [{ serviceId: "h1" }, { serviceId: "t1" }, { serviceId: "h2" }, { serviceId: "t2" }];

  it("separates telemedicine from home-based care and keeps each list's order", () => {
    const { home, telemedicine } = splitServicesByKind(services, new Set(["t1", "t2"]));
    expect(home.map((s) => s.serviceId)).toEqual(["h1", "h2"]);
    expect(telemedicine.map((s) => s.serviceId)).toEqual(["t1", "t2"]);
  });

  it("puts everything under home-based care when no telemedicine services are known", () => {
    const { home, telemedicine } = splitServicesByKind(services, new Set());
    expect(home).toHaveLength(4);
    expect(telemedicine).toEqual([]);
  });

  it("never drops or duplicates a service", () => {
    const { home, telemedicine } = splitServicesByKind(services, new Set(["t1"]));
    expect(home.length + telemedicine.length).toBe(services.length);
  });
});

describe("defaultServiceKind", () => {
  it.each([
    [3, 2, "home"],
    [3, 0, "home"],
    [0, 0, "home"],
    [0, 4, "telemedicine"]
  ] as const)("%i home, %i telemedicine opens on %s", (home, telemedicine, kind) => {
    expect(defaultServiceKind(home, telemedicine)).toBe(kind);
  });
});
