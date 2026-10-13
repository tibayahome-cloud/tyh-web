import { Component, Suspense, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RELOAD_FLAG_KEY, installStaleChunkHandler, lazyWithRetry, reloadOnceForStaleChunk } from "../lazyWithRetry";

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <p>failed: {this.state.error.message}</p> : this.props.children;
  }
}

const reload = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reload.mockClear();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const renderLazy = (importer: () => Promise<{ default: () => JSX.Element }>) => {
  const Page = lazyWithRetry(importer);
  return render(
    <Boundary>
      <Suspense fallback={<p>loading</p>}>
        <Page />
      </Suspense>
    </Boundary>
  );
};

describe("reloadOnceForStaleChunk", () => {
  it("reloads the first time and not again", () => {
    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_FLAG_KEY)).toBe("1");
  });

  it("does not reload when it cannot remember that it already did", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("lazyWithRetry", () => {
  it("renders the page and clears the retry marker once a chunk loads", async () => {
    sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
    renderLazy(async () => ({ default: () => <p>facilities page</p> }));
    expect(await screen.findByText("facilities page")).toBeInTheDocument();
    expect(sessionStorage.getItem(RELOAD_FLAG_KEY)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when the chunk is missing, and keeps the loading state meanwhile", async () => {
    renderLazy(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module")));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByText(/failed:/)).not.toBeInTheDocument();
  });

  it("shows the error instead of reloading again when the chunk is still missing after a reload", async () => {
    sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderLazy(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module")));
    expect(await screen.findByText(/failed: Failed to fetch dynamically imported module/)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("installStaleChunkHandler", () => {
  it("reloads once for Vite's preload error and lets a second one through", () => {
    installStaleChunkHandler();
    const first = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    const second = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
