"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminSupportListQuery, ResolveSupportRequestData } from "@booking/shared";
import { fetchSupportRequests, resolveSupportRequest } from "./api";

export const adminSupportKeys = {
  all: ["admin-support-requests"] as const,
  lists: () => [...adminSupportKeys.all, "list"] as const,
  list: (query: AdminSupportListQuery) => [...adminSupportKeys.lists(), query] as const,
};

export function useSupportRequests(query: AdminSupportListQuery) {
  return useQuery({
    queryKey: adminSupportKeys.list(query),
    queryFn: () => fetchSupportRequests(query),
    placeholderData: keepPreviousData,
  });
}

/** Answer (and resolve) one request. Lists refetch either way: a 409 means someone else answered first. */
export function useResolveSupportRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveSupportRequestData) => resolveSupportRequest(id, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminSupportKeys.lists() }),
  });
}
