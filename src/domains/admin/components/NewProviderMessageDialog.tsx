import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { Modal } from "../../../shared/components/Modal";
import { PersonPicker, type PickerPerson } from "../../../shared/components/messaging/PersonPicker";
import ApiErrorBanner from "../../../shared/components/ApiErrorBanner";
import { fetchFacilityProviders } from "../../../shared/libs/facilities";
import { classifyApiError } from "../../../shared/utils/errors";

type Props = {
  open: boolean;
  facilityId: string | null;
  facilityName?: string | null;
  /** User ids of providers this admin already has a conversation with. */
  continueIds: Set<string>;
  starting: boolean;
  onClose: () => void;
  /** Start (or reopen) the conversation with this provider's account. */
  onStart: (providerUserId: string) => void;
};

/**
 * A facility admin writes to the providers of their own facility: one row per provider, a search once the list is long,
 * and the buttons pinned below the list so they never scroll out of sight.
 */
export const NewProviderMessageDialog = ({ open, facilityId, facilityName, continueIds, starting, onClose, onStart }: Props) => {
  const [selected, setSelected] = useState("");

  const query = useQuery({
    queryKey: ["admin", "inbox", "facility-providers", facilityId],
    queryFn: () => fetchFacilityProviders(String(facilityId), { pageSize: 100 }),
    enabled: open && Boolean(facilityId)
  });

  const people: PickerPerson[] = useMemo(() => {
    const rows = (query.data?.providers ?? [])
      .filter((provider) => provider.userId)
      .map((provider) => {
        const continuing = continueIds.has(provider.userId);
        return {
          id: provider.userId,
          name: provider.user?.fullName || provider.user?.email || "Provider",
          detail: provider.user?.email && provider.user?.fullName ? provider.user.email : undefined,
          // Text, not colour alone: who is free to answer, and who you are already talking to.
          note: continuing ? "Continue conversation" : provider.isAvailable ? "Available now" : "Not available now",
          continuing
        };
      })
      .sort((a, b) => Number(b.continuing) - Number(a.continuing) || a.name.localeCompare(b.name));
    return rows.map(({ continuing: _continuing, ...person }) => person);
  }, [query.data?.providers, continueIds]);

  const close = () => {
    setSelected("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="New message" flush>
      <div className="flex max-h-[calc(100dvh-8rem)] sm:max-h-[calc(100dvh-14rem)] flex-col gap-4 pt-1">
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ApiErrorBanner {...classifyApiError(query.error, "We could not load your providers.")} onRetry={() => void query.refetch()} />
        ) : people.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            Your facility has no providers yet. Add one from Providers, then you can message them here.
          </p>
        ) : (
          <PersonPicker
            people={people}
            selectedId={selected}
            onSelect={setSelected}
            helper={facilityName ? `Providers at ${facilityName}.` : "Providers at your facility."}
            noun="providers"
            groupName="facility-provider"
          />
        )}
        <div className="flex shrink-0 gap-3 border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" className="min-h-[44px] flex-1" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-[44px] flex-1 disabled:bg-slate-200 disabled:text-slate-600"
            loading={starting}
            disabled={!selected}
            onClick={() => onStart(selected)}
          >
            {continueIds.has(selected) ? "Open conversation" : "Start conversation"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
