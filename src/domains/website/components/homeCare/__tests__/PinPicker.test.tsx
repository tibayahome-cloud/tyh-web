import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapApi = vi.hoisted(() => ({
  props: null as null | { onIdle: () => void; onDragStart: () => void },
  centre: { lat: -1.2921, lng: 36.8219 },
  panTo: vi.fn(),
  setZoom: vi.fn()
}));
const geo = vi.hoisted(() => ({ describePlace: vi.fn() }));

vi.mock("@react-google-maps/api", async () => {
  const React = await import("react");
  return {
    useJsApiLoader: () => ({ isLoaded: true }),
    GoogleMap: (props: { children?: React.ReactNode; onLoad: (map: unknown) => void; onIdle: () => void; onDragStart: () => void }) => {
      mapApi.props = props;
      React.useEffect(() => {
        props.onLoad({ getCenter: () => ({ toJSON: () => mapApi.centre }), panTo: mapApi.panTo, setZoom: mapApi.setZoom });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="map">{props.children}</div>;
    },
    Circle: ({ radius }: { radius: number }) => <div data-testid="accuracy-circle" data-radius={radius} />
  };
});
vi.mock("../../../../../shared/hooks/useMapFailed", () => ({ useMapFailed: () => false }));
vi.mock("../../../../../shared/utils/geocoding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../shared/utils/geocoding")>()),
  describePlace: geo.describePlace,
  searchPlaces: vi.fn(async () => [])
}));
vi.mock("../../../../client/components/PlacePicker", () => ({
  PlacePicker: () => <div data-testid="fallback-picker">Search and current location only</div>
}));

import { PinPicker } from "../PinPicker";

const HOME = { lat: -1.2921, lng: 36.8219 };
const device = (over: Partial<{ coords: typeof HOME | null; accuracyM: number | null; locating: boolean }> = {}) => ({
  coords: HOME, accuracyM: 25, locating: false, ask: vi.fn(), ...over
});

beforeEach(() => {
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
  mapApi.centre = HOME;
  mapApi.panTo.mockReset();
  mapApi.setZoom.mockReset();
  geo.describePlace.mockReset();
  geo.describePlace.mockResolvedValue({ address: "Plot 12, Argwings Kodhek Rd, Nairobi", plusCode: "7GRP+J3 Nairobi" });
});
afterEach(() => vi.unstubAllEnvs());

describe("the pin picker", () => {
  it("shows the address in full with its plus code, and how sure the device was", () => {
    render(<PinPicker value={{ name: "Plot 12, Argwings Kodhek Rd, Nairobi", coords: HOME, plusCode: "7GRP+J3 Nairobi" }} onChange={vi.fn()} device={device()} />);

    expect(screen.getByText("Plot 12, Argwings Kodhek Rd, Nairobi")).toBeInTheDocument();
    expect(screen.getByText("Plus code 7GRP+J3 Nairobi")).toBeInTheDocument();
    expect(screen.getByTestId("accuracy-circle")).toHaveAttribute("data-radius", "25");
    expect(screen.getByText(/within about 25 metres/)).toBeInTheDocument();
    expect(screen.getByText("Move the map to put the pin on your gate")).toBeInTheDocument();
  });

  it("says so plainly when the device could only place the person roughly", () => {
    render(<PinPicker value={{ name: "Starehe, Nairobi", coords: HOME }} onChange={vi.fn()} device={device({ accuracyM: 1800 })} />);

    expect(screen.getByText(/only place you roughly \(about 1\.8 km\)/)).toBeInTheDocument();
  });

  it("names the new spot when the map settles after a move, and not when it has not moved", async () => {
    const onChange = vi.fn();
    render(<PinPicker value={{ name: "Old", coords: HOME }} onChange={onChange} device={device()} />);

    act(() => mapApi.props?.onIdle());
    expect(geo.describePlace).not.toHaveBeenCalled();

    mapApi.centre = { lat: -1.3, lng: 36.83 };
    act(() => mapApi.props?.onIdle());
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        name: "Plot 12, Argwings Kodhek Rd, Nairobi", coords: { lat: -1.3, lng: 36.83 }, plusCode: "7GRP+J3 Nairobi"
      })
    );
  });

  it("uses a visible label when the address cannot be found, never the numbers", async () => {
    geo.describePlace.mockResolvedValue(null);
    const onChange = vi.fn();
    render(<PinPicker value={{ name: "Old", coords: HOME }} onChange={onChange} device={device()} />);

    mapApi.centre = { lat: -1.4, lng: 36.9 };
    act(() => mapApi.props?.onIdle());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Pinned location", plusCode: null })));
  });

  it("ignores a slow answer for an earlier move once the pin has moved again", async () => {
    let releaseFirst: (value: { address: string; plusCode: null }) => void = () => {};
    geo.describePlace
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValueOnce({ address: "Second place", plusCode: null });
    const onChange = vi.fn();
    render(<PinPicker value={{ name: "Old", coords: HOME }} onChange={onChange} device={device()} />);

    mapApi.centre = { lat: -1.31, lng: 36.84 };
    act(() => mapApi.props?.onIdle());
    mapApi.centre = { lat: -1.32, lng: 36.85 };
    act(() => mapApi.props?.onIdle());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Second place" })));
    await act(async () => releaseFirst({ address: "First place", plusCode: null }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("moves the map when something else changes the place (a device reading or a search result)", () => {
    const { rerender } = render(<PinPicker value={{ name: "Here", coords: HOME }} onChange={vi.fn()} device={device()} />);
    mapApi.panTo.mockReset();

    rerender(<PinPicker value={{ name: "Elsewhere", coords: { lat: -1.35, lng: 36.9 } }} onChange={vi.fn()} device={device()} />);

    expect(mapApi.panTo).toHaveBeenCalledWith({ lat: -1.35, lng: 36.9 });
  });

  it("falls back to search and current location when there is no map key", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    render(<PinPicker value={null} onChange={vi.fn()} device={device()} />);

    expect(screen.getByTestId("fallback-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });
});
