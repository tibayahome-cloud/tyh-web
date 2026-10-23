import { describe, expect, it } from "vitest";

import { isCoordinateText, shortPlaceName, UNNAMED_PLACE } from "../geocoding";

describe("shortPlaceName", () => {
  it("names a place the way a maps app does: street, area, town", () => {
    expect(shortPlaceName({ road: "Argwings Kodhek Road", suburb: "Kilimani", city: "Nairobi", state: "Nairobi County" })).toBe(
      "Argwings Kodhek Road, Kilimani, Nairobi"
    );
  });

  it("does not repeat a name and drops what it does not have", () => {
    expect(shortPlaceName({ suburb: "Kilimani", city: "Kilimani" })).toBe("Kilimani");
    expect(shortPlaceName({ town: "Ruiru" })).toBe("Ruiru");
  });

  it("falls back to the start of the full label, and never to coordinates", () => {
    expect(shortPlaceName({}, "Yaya Centre, Argwings Kodhek Rd, Nairobi, Kenya")).toBe("Yaya Centre, Argwings Kodhek Rd, Nairobi");
    expect(shortPlaceName({}, "-1.2278, 36.7408")).toBe(UNNAMED_PLACE);
    expect(shortPlaceName({}, null)).toBe(UNNAMED_PLACE);
  });
});

describe("isCoordinateText", () => {
  it("recognises text that is only a latitude and longitude", () => {
    expect(isCoordinateText("-1.2278, 36.7408")).toBe(true);
    expect(isCoordinateText("-1.2278 36.7408")).toBe(true);
    expect(isCoordinateText("Kilimani, Nairobi")).toBe(false);
    expect(isCoordinateText("")).toBe(false);
    expect(isCoordinateText(null)).toBe(false);
  });
});
