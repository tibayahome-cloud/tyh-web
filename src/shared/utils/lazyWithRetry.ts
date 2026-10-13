import { lazy, type ComponentType, type LazyExoticComponent } from "react";

// A new deploy replaces the hashed chunk files (FacilityManagementPage-xxxx.js and the rest). A tab
// that was open before the deploy still points at the old names, and the server answers those with
// the app's HTML page, so the dynamic import fails with "Failed to fetch dynamically imported
// module". Reloading fetches the new index and the new names.
//
// The reload happens once: if the same failure comes back after a reload, the error is shown
// instead of trapping the person in a reload loop.
export const RELOAD_FLAG_KEY = "chunk-reload-attempted";

const storage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

// Returns true when a reload was started, false when one was already tried.
export const reloadOnceForStaleChunk = (): boolean => {
  const store = storage();
  // Without storage there is no way to remember that a reload was tried, so do not risk a loop.
  if (!store || store.getItem(RELOAD_FLAG_KEY)) return false;
  store.setItem(RELOAD_FLAG_KEY, "1");
  window.location.reload();
  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any component props, as React.lazy allows
export const lazyWithRetry = <T extends { default: ComponentType<any> }>(
  importer: () => Promise<T>
): LazyExoticComponent<T["default"]> =>
  lazy(() =>
    importer()
      .then((module) => {
        // Clear the marker only once a chunk has actually loaded.
        storage()?.removeItem(RELOAD_FLAG_KEY);
        return module;
      })
      .catch((error) => {
        if (reloadOnceForStaleChunk()) {
          // The page is about to reload; keep the Suspense fallback up until then.
          return new Promise<T>(() => {});
        }
        throw error;
      })
  );

// Vite raises this when it cannot preload a chunk or its CSS. It covers failures that never reach a
// lazy() call, such as a stylesheet that no longer exists.
export const installStaleChunkHandler = (): void => {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnceForStaleChunk()) event.preventDefault();
  });
};
