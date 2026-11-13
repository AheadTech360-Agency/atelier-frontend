import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "./api";

type Query = Record<string, string | number | boolean | null | undefined>;

/**
 * A list that loads one page at a time (limit/offset), so the dashboard never pulls a whole table.
 * The backend caps every page at 200 rows; a short page means there's nothing more.
 */
export function usePagedList<T>(key: unknown[], path: string, query: Query = {}, pageSize = 50, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: [...key, query, pageSize],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get<T[]>(path, { ...query, limit: pageSize, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length < pageSize ? undefined : all.length * pageSize),
  });
  return {
    items: q.data?.pages.flat() ?? [],
    isLoading: q.isLoading,
    error: q.error,
    hasMore: !!q.hasNextPage,
    loadMore: () => q.fetchNextPage(),
    loadingMore: q.isFetchingNextPage,
  };
}
