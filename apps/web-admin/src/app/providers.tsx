"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import "@/lib/zod-locale";
import { adminAuditLogKeys } from "@/features/audit-logs/hooks";
import { authKeys } from "@/features/auth/hooks";

function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // A 401 from any query other than `me` means the session is gone
      onError: (error, query) => {
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          query.queryKey[0] !== authKeys.all[0]
        ) {
          client.setQueryData(authKeys.me(), null);
        }
      },
    }),
    mutationCache: new MutationCache({
      // Every admin write adds a history row; the history list can't know which, so refresh it after any.
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: adminAuditLogKeys.all });
      },
      // A 401 from any non-auth mutation means the session is gone. Auth mutations
      // (keyed under authKeys.all) handle their own 401s, e.g. a wrong password on login.
      onError: (error, _variables, _context, mutation) => {
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          mutation.options.mutationKey?.[0] !== authKeys.all[0]
        ) {
          client.setQueryData(authKeys.me(), null);
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Never retry client errors (4xx); retry anything else up to 2 times
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
  return client;
}

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session (not shared across requests on the server)
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
