"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingKeys } from "@/features/bookings/hooks";
import { startPayment, syncPayment } from "./api";

export const paymentKeys = {
  all: ["payments"] as const,
  start: (code: string) => [...paymentKeys.all, "start", code] as const,
};

/**
 * The PaymentIntent client secret for a payable booking. A query (not a mutation) so the Element can
 * mount on page load; the API reuses the live intent, so refetching is harmless but never needed.
 */
export function useStartPayment(code: string, enabled: boolean) {
  return useQuery({
    queryKey: paymentKeys.start(code),
    queryFn: () => startPayment(code),
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSyncPayment(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...paymentKeys.all, "sync", code],
    mutationFn: () => syncPayment(code),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(booking.code), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}
