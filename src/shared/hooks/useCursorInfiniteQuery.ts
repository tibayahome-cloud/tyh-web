import { useInfiniteQuery, type UseInfiniteQueryOptions, type InfiniteData } from "@tanstack/react-query";
import type { CursorResponse } from "../libs/api";

type QueryFn<T> = (context: { pageParam: string | null }) => Promise<CursorResponse<T>>;

export function useCursorInfiniteQuery<T>(
    queryKey: readonly unknown[],
    queryFn: QueryFn<T>,
    options?: Omit<
        UseInfiniteQueryOptions<
            CursorResponse<T>,
            Error,
            InfiniteData<CursorResponse<T>>,
            readonly unknown[],
            string | null
        >,
        "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
    >
) {
    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => queryFn({ pageParam: pageParam as string | null }),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.meta.next_cursor || null,
        ...options
    });
}
