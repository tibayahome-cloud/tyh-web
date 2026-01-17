const STORAGE_KEY = "client.recentLocations.v1";

export type StoredLocation = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  addressText?: string | null;
  savedAt: string;
};

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readStorage = (): StoredLocation[] => {
  if (!isBrowser()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is StoredLocation =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.lat === "number" &&
        typeof entry.lng === "number" &&
        typeof entry.label === "string"
    );
  } catch {
    return [];
  }
};

const persist = (entries: StoredLocation[]) => {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota issues
  }
};

export const loadRecentLocations = (): StoredLocation[] => readStorage();

type SaveLocationInput = {
  lat: number;
  lng: number;
  addressText?: string | null;
  label?: string;
};

const sameLocation = (a: StoredLocation, b: SaveLocationInput) =>
  Math.abs(a.lat - b.lat) < 0.00001 &&
  Math.abs(a.lng - b.lng) < 0.00001 &&
  (a.addressText?.trim() ?? "") === (b.addressText?.trim() ?? "");

export const saveRecentLocation = (input: SaveLocationInput): StoredLocation[] => {
  const entries = readStorage();
  const labelFromInput =
    input.label?.trim() && input.label.trim().length > 0
      ? input.label.trim()
      : input.addressText?.trim() && input.addressText.trim().length > 0
      ? input.addressText.trim()
      : `Lat ${input.lat.toFixed(3)}, Lng ${input.lng.toFixed(3)}`;

  const filtered = entries.filter((entry) => !sameLocation(entry, input));
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `loc-${Date.now()}`;
  const next: StoredLocation[] = [
    {
      id,
      label: labelFromInput,
      lat: input.lat,
      lng: input.lng,
      addressText: input.addressText,
      savedAt: new Date().toISOString()
    },
    ...filtered
  ].slice(0, 5);

  persist(next);
  return next;
};

export const clearRecentLocations = () => persist([]);
