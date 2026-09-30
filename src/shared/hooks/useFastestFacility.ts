import { useMutation } from "@tanstack/react-query";

import { discoverRemoteFacilities, type RemoteFacility } from "../libs/telemedicine";

export type FastestFacilityResult = {
  // The facility with the earliest open appointment, or null when none has one.
  facility: RemoteFacility | null;
  // That appointment's start (ISO). The slot list is asked for again before anything is held.
  earliestAvailableAt: string | null;
};

// Finds the facility with the earliest open appointment for a service. It runs only when the
// person asks for it (never as part of showing the manual facility list, whose request and order
// are untouched), because the API works out each facility's availability to answer it.
export const useFastestFacility = () =>
  useMutation({
    mutationFn: async ({ serviceId, countryCode }: { serviceId: string; countryCode?: string }): Promise<FastestFacilityResult> => {
      const ranked = await discoverRemoteFacilities(serviceId, countryCode, { ranking: "earliest_slot" });
      const facility = ranked.find((entry) => entry.earliestAvailableAt) ?? null;
      return { facility, earliestAvailableAt: facility?.earliestAvailableAt ?? null };
    }
  });
