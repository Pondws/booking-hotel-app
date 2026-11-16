"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSupportRequestData } from "@booking/shared";
import { createSupportRequest, fetchSupportRequests } from "./api";

export const supportKeys = {
  all: ["support-requests"] as const,
  booking: (code: string) => [...supportKeys.all, code] as const,
};

export function useSupportRequests(code: string) {
  return useQuery({ queryKey: supportKeys.booking(code), queryFn: () => fetchSupportRequests(code) });
}

export function useCreateSupportRequest(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportRequestData) => createSupportRequest(code, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supportKeys.booking(code) }),
  });
}
