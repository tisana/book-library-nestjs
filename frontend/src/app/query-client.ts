import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/query-keys';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function millisecondsUntilNextLocalDay(now = new Date()) {
  const nextLocalDay = new Date(now);
  nextLocalDay.setHours(24, 0, 0, 0);

  return Math.max(nextLocalDay.getTime() - now.getTime(), 60_000);
}

export async function invalidateLibraryData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.books.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.members.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.borrowings.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.memberSelf.profile }),
    queryClient.invalidateQueries({ queryKey: queryKeys.memberSelf.policy }),
    queryClient.invalidateQueries({ queryKey: ['member', 'borrowings'] }),
  ]);
}
