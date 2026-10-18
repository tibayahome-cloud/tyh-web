import type { QueryClient } from "@tanstack/react-query";

export const blackoutsQueryKey = (userId: string | undefined) => ["provider", "blackouts", userId] as const;

/**
 * Removes a deleted blackout from the cached list so the screen updates the moment the DELETE
 * succeeds, then refreshes in the background instead of making the provider wait on a refetch.
 */
export const removeBlackoutFromCache = (queryClient: QueryClient, userId: string | undefined, blackoutId: string) => {
  queryClient.setQueryData<Array<{ id: string }>>(blackoutsQueryKey(userId), (current) =>
    current ? current.filter((entry) => entry.id !== blackoutId) : current
  );
  void queryClient.invalidateQueries({ queryKey: blackoutsQueryKey(userId) });
};
