import { useEffect, useState } from "react";
import classNames from "classnames";
import Drawer from "@mui/material/Drawer";
import { X, Zap } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import {
  NO_FILTERS,
  PRICE_BANDS,
  filterServices,
  type CatalogFilters,
  type CatalogService,
  type GroupTile
} from "../utils/serviceCatalog";

type Props = {
  open: boolean;
  onClose: () => void;
  filters: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
  groups: GroupTile[];
  services: CatalogService[];
  imageForGroup: (groupId: GroupTile["id"]) => string;
  allImage: string;
};

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue focus-visible:ring-offset-2";

/**
 * Every filter in one place, the same on every screen: a sheet that rises from the bottom on a phone and a panel on the
 * right on a computer. Choices are held as a draft until "Show n services", which says what applying will give, so
 * nobody lands on an empty list.
 */
export const ServiceFilterSheet = ({ open, onClose, filters, onApply, groups, services, imageForGroup, allImage }: Props) => {
  const phone = useMediaQuery("(max-width: 639px)");
  const [draft, setDraft] = useState<CatalogFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const matches = filterServices(services, draft).length;
  const countFor = (groupId: CatalogFilters["groupId"]) => filterServices(services, { ...draft, groupId }).length;

  return (
    <Drawer
      anchor={phone ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: phone
          ? { maxHeight: "90dvh", borderRadius: "20px 20px 0 0" }
          : { width: 420, maxWidth: "100%" }
      }}
      aria-labelledby="service-filters-title"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="service-filters-title" className="text-lg font-semibold text-slate-900">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className={classNames("flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100", focusRing)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-900">Kind of care</legend>
            <div role="radiogroup" aria-label="Kind of care" className="space-y-2">
              {[{ id: "all" as const, name: "All kinds of care", image: allImage }, ...groups.map((g) => ({ ...g, image: imageForGroup(g.id) }))].map((option) => {
                const selected = draft.groupId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDraft((d) => ({ ...d, groupId: option.id }))}
                    className={classNames(
                      "flex min-h-[56px] w-full items-center gap-3 rounded-xl border p-2 text-left",
                      focusRing,
                      selected ? "border-tiba-blue bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <img src={option.image} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{option.name}</span>
                    <span className="shrink-0 pr-2 text-sm text-slate-600">{countFor(option.id)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.urgentOnly}
              onClick={() => setDraft((d) => ({ ...d, urgentOnly: !d.urgentOnly }))}
              className={classNames(
                "flex min-h-[56px] w-full items-center gap-3 rounded-xl border p-3 text-left",
                focusRing,
                draft.urgentOnly ? "border-rose-700 bg-rose-50" : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-700 text-white">
                <Zap size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">Urgent care only</span>
                <span className="block text-sm text-slate-600">Services that can respond straight away</span>
              </span>
              <span
                aria-hidden="true"
                className={classNames("flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors motion-reduce:transition-none", draft.urgentOnly ? "bg-rose-700" : "bg-slate-300")}
              >
                <span className={classNames("h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none", draft.urgentOnly ? "translate-x-5" : "translate-x-0")} />
              </span>
            </button>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-900">Price</legend>
            <div role="radiogroup" aria-label="Price" className="flex flex-wrap gap-2">
              {PRICE_BANDS.map((band) => {
                const selected = draft.priceBand === band.id;
                return (
                  <button
                    key={band.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDraft((d) => ({ ...d, priceBand: band.id }))}
                    className={classNames(
                      "min-h-[44px] rounded-full border px-4 text-sm font-medium",
                      focusRing,
                      selected ? "border-tiba-blue bg-tiba-blue text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    )}
                  >
                    {band.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 bg-white px-5 py-4">
          <Button type="button" variant="ghost" className="min-h-[48px]" onClick={() => setDraft({ ...NO_FILTERS, search: filters.search })}>
            Clear all
          </Button>
          <Button
            type="button"
            className="min-h-[48px] flex-1"
            disabled={matches === 0}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {matches === 0 ? "No services match" : `Show ${matches} ${matches === 1 ? "service" : "services"}`}
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
