import { describe, expect, it } from "vitest";

import { locationFromPlace } from "../LocationPickerMap";

describe("locationFromPlace", () => {
  it("extracts coordinates and a formatted address", () => {
    expect(locationFromPlace({
      formatted_address: "Nairobi, Kenya",
      geometry: { location: { lat: () => -1.2864, lng: () => 36.8172 } }
    })).toEqual({
      coords: { lat: -1.2864, lng: 36.8172 },
      address: "Nairobi, Kenya"
    });
  });

  it("returns null when a place has no geometry", () => {
    expect(locationFromPlace({ formatted_address: "Nairobi" })).toBeNull();
  });
});
