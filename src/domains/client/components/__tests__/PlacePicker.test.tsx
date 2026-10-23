/**
 * Choosing where the provider should come: one clear button for the current location, or a search by name. The chosen
 * place is shown by name and its coordinates are never on screen.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const geo = vi.hoisted(() => ({ reverse: vi.fn(), search: vi.fn() }));
vi.mock("../../../../shared/utils/geocoding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../shared/utils/geocoding")>();
  return { ...actual, reverseGeocode: geo.reverse, searchPlaces: geo.search };
});
vi.mock("../../../../shared/components/LocationPickerMap", () => ({ LocationPickerMap: () => null }));

import { PlacePicker } from "../PlacePicker";

const position = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } });

const mockGeolocation = (impl: (ok: (p: unknown) => void, fail: (e: { code: number }) => void) => void) => {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) }
  });
};

beforeEach(() => {
  geo.reverse.mockReset();
  geo.search.mockReset();
  geo.search.mockResolvedValue([]);
});

describe("PlacePicker", () => {
  it("offers one clear button for the current location and a search, with no numbers anywhere", () => {
    render(<PlacePicker value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Use my current location" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search for an address or place" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/-?\d+\.\d{3,}/);
  });

  it("uses the current location and shows it by name", async () => {
    mockGeolocation((ok) => ok(position(-1.2278, 36.7408)));
    geo.reverse.mockResolvedValue("Argwings Kodhek Road, Kilimani, Nairobi");
    const onChange = vi.fn();
    render(<PlacePicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Use my current location" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        { name: "Argwings Kodhek Road, Kilimani, Nairobi", coords: { lat: -1.2278, lng: 36.7408 } },
        "current"
      )
    );
  });

  it("says Current location, never numbers, when the place has no name", async () => {
    mockGeolocation((ok) => ok(position(-1.2278, 36.7408)));
    geo.reverse.mockResolvedValue(null);
    const onChange = vi.fn();
    render(<PlacePicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Use my current location" }));

    await waitFor(() => expect(onChange.mock.calls[0][0].name).toBe("Current location"));
  });

  it("explains a blocked location and points to searching instead", async () => {
    mockGeolocation((_ok, fail) => fail({ code: 1 }));
    render(<PlacePicker value={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Use my current location" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/blocked.*search for your address/i);
  });

  it("searches by name, lists matches, and picks one with the keyboard", async () => {
    const suggestion = (primary: string, place: { name: string; coords: { lat: number; lng: number } }) => ({
      primary,
      secondary: "Kilimani, Nairobi",
      resolve: async () => place
    });
    geo.search.mockResolvedValue([
      suggestion("Yaya Centre", { name: "Yaya Centre, Kilimani, Nairobi", coords: { lat: -1.29, lng: 36.79 } }),
      suggestion("Yaya Towers", { name: "Yaya Towers, Kilimani, Nairobi", coords: { lat: -1.3, lng: 36.8 } })
    ]);
    const onChange = vi.fn();
    render(<PlacePicker value={null} onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Search for an address or place" });

    fireEvent.change(box, { target: { value: "yaya" } });
    expect(await screen.findByRole("option", { name: /Yaya Centre/ })).toBeInTheDocument();
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ name: "Yaya Towers, Kilimani, Nairobi", coords: { lat: -1.3, lng: 36.8 } }, "search")
    );
  });

  it("says when nothing matches", async () => {
    render(<PlacePicker value={null} onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Search for an address or place" }), { target: { value: "zzzzzz" } });

    expect(await screen.findByText(/No place found/)).toBeInTheDocument();
  });

  it("shows a chosen place by name with a Change button, and never its coordinates", () => {
    render(<PlacePicker value={{ name: "Kilimani, Nairobi", coords: { lat: -1.2278, lng: 36.7408 } }} onChange={vi.fn()} />);

    expect(screen.getByText("Kilimani, Nairobi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/1\.2278|36\.7408/);

    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("button", { name: "Use my current location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep Kilimani, Nairobi" })).toBeInTheDocument();
  });
});
