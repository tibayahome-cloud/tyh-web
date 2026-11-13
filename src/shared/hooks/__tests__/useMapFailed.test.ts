import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMapFailed } from "../useMapFailed";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  delete (window as unknown as { gm_authFailure?: unknown }).gm_authFailure;
});

describe("useMapFailed", () => {
  it("is false while nothing has gone wrong", () => {
    const { result } = renderHook(() => useMapFailed(true));
    expect(result.current).toBe(false);
  });

  it("turns true when Google refuses the key, and keeps any handler that was already there", () => {
    const earlier = vi.fn();
    (window as unknown as { gm_authFailure: () => void }).gm_authFailure = earlier;
    const { result } = renderHook(() => useMapFailed(true));

    act(() => (window as unknown as { gm_authFailure: () => void }).gm_authFailure());

    expect(result.current).toBe(true);
    expect(earlier).toHaveBeenCalledTimes(1);
  });

  it("turns true when Google draws its own error panel in the map", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMapFailed(true));
    const panel = document.createElement("div");
    panel.className = "gm-err-container";
    document.body.appendChild(panel);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current).toBe(true);
  });

  it("turns true when Google shows its 'can't load Google Maps correctly' box over the map", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMapFailed(true));
    const map = document.createElement("div");
    map.className = "gm-style";
    const box = document.createElement("div");
    box.textContent = "This page can't load Google Maps correctly.";
    map.appendChild(box);
    document.body.appendChild(map);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current).toBe(true);
  });

  it("turns true when no map has been drawn after ten seconds, but not while nothing is being watched", () => {
    vi.useFakeTimers();
    const watching = renderHook(() => useMapFailed(true));
    const idle = renderHook(() => useMapFailed(false));

    act(() => {
      vi.advanceTimersByTime(11000);
    });

    expect(watching.result.current).toBe(true);
    expect(idle.result.current).toBe(false);
  });
});
