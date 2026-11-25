import classNames from "classnames";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { Modal } from "../../../shared/components/Modal";
import ApiErrorBanner from "../../../shared/components/ApiErrorBanner";
import { fetchFacilityProviders } from "../../../shared/libs/facilities";
import { classifyApiError } from "../../../shared/utils/errors";

type Props = {
  open: boolean;
  facilityId: string | null;
  starting: boolean;
  onClose: () => void;
  /** Start (or reopen) the conversation with this provider's account. */
  onStart: (providerUserId: string) => void;
};

/**
 * A facility admin writes to the providers of their own facility: one row per provider, a search once the list is long,
 * and the buttons pinned below the list so they never scroll out of sight.
 */
export const NewProviderMessageDialog = ({ open, facilityId, starting, onClose, onStart }: Props) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");

  const query = useQuery({
    queryKey: ["admin", "inbox", "facility-providers", facilityId],
    queryFn: () => fetchFacilityProviders(String(facilityId), { pageSize: 100 }),
    enabled: open && Boolean(facilityId)
  });

  const people = useMemo(
    () =>
      (query.data?.providers ?? [])
        .filter((provider) => provider.userId)
        .map((provider) => ({
          userId: provider.userId,
          name: provider.user?.fullName || provider.user?.email || "Provider",
          detail: provider.user?.email && provider.user?.fullName ? provider.user.email : ""
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [query.data?.providers]
  );
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? people.filter((person) => `${person.name} ${person.detail}`.toLowerCase().includes(needle)) : people;
  }, [people, search]);

  const close = () => {
    setSearch("");
    setSelected("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="New message" description="Write to a provider at your facility.">
      <div className="flex max-h-[calc(100dvh-11rem)] flex-col gap-4 pt-2">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {query.isLoading ? (
            <Loading />
          ) : query.isError ? (
            <ApiErrorBanner {...classifyApiError(query.error, "We could not load your providers.")} onRetry={() => void query.refetch()} />
          ) : people.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              Your facility has no providers yet. Add one from Providers, then you can message them here.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">Your facility&rsquo;s providers. Pick one to write to.</p>
              {people.length > 5 && (
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search providers"
                  placeholder="Search providers"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
                />
              )}
              {shown.length === 0 ? (
                <p role="status" className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  No provider matches &ldquo;{search.trim()}&rdquo;.
                </p>
              ) : (
                <fieldset className="space-y-2">
                  <legend className="sr-only">Choose a provider</legend>
                  {shown.map((person) => (
                    <label
                      key={person.userId}
                      className={classNames(
                        "flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border p-3",
                        selected === person.userId ? "border-tiba-blue bg-sky-50" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="radio"
                        name="facility-provider"
                        checked={selected === person.userId}
                        onChange={() => setSelected(person.userId)}
                        className="h-4 w-4"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{person.name}</span>
                        {person.detail && <span className="block text-sm text-slate-600">{person.detail}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" className="min-h-[44px] flex-1" onClick={close}>
            Cancel
          </Button>
          <Button type="button" className="min-h-[44px] flex-1" loading={starting} disabled={!selected} onClick={() => onStart(selected)}>
            Start conversation
          </Button>
        </div>
      </div>
    </Modal>
  );
};
