import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { searchPlaces, type Place, type PlaceSuggestion } from "../../../../shared/utils/geocoding";

const SEARCH_DELAY_MS = 300;

/** Type an address, an estate or a building and pick it from the list; the map then moves there. */
export const PlaceSearch = ({ onPick }: { onPick: (place: Place) => void }) => {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState(false);
  const [active, setActive] = useState(-1);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    const mine = ++run.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const found = await searchPlaces(text);
      if (mine !== run.current) return;
      setResults(found);
      setActive(-1);
      setSearching(false);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const choose = async (suggestion: PlaceSuggestion) => {
    if (opening) return;
    setOpening(true);
    const place = await suggestion.resolve();
    setOpening(false);
    if (!place) {
      setNotice("We could not open that place. Try another one.");
      return;
    }
    setNotice(null);
    setQuery("");
    setResults([]);
    onPick(place);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      void choose(results[active]);
    } else if (event.key === "Escape") {
      setResults([]);
    }
  };

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">Search for your address, estate or building</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-6 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search your address or estate"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-10 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/30"
        />
        {(searching || opening) && (
          <Loader2 aria-hidden="true" className="absolute right-4 top-6 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500 motion-reduce:animate-none" />
        )}
      </label>

      {results.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Matching places" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((place, index) => (
            <li key={`${place.primary}-${index}`} role="option" id={`${listId}-${index}`} aria-selected={index === active}>
              <button
                type="button"
                onClick={() => void choose(place)}
                className={`flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-sm text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100 ${
                  index === active ? "bg-slate-100" : ""
                }`}
              >
                <MapPin aria-hidden="true" size={16} className="shrink-0 text-slate-500" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{place.primary}</span>
                  {place.secondary && <span className="block truncate text-slate-600">{place.secondary}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 min-h-[20px] text-sm text-slate-600" role="status" aria-live="polite">
        {notice ?? (query.trim().length >= 3 && !searching && results.length === 0 ? "No place found. Try the estate, street or a nearby building." : "")}
      </p>
    </div>
  );
};
