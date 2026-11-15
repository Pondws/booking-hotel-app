"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { hotelKeys } from "@/features/hotels/hooks";
import { cancelBooking, createBooking, fetchBooking, fetchMyBookings } from "./api";

export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (page: number) => [...bookingKeys.lists(), page] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (code: string) => [...bookingKeys.details(), code] as const,
};

const availabilityPrefix = (hotelSlug: string) => [...hotelKeys.detail(hotelSlug), "availability"];

export function useMyBookings(page: number) {
  return useQuery({
    queryKey: bookingKeys.list(page),
    queryFn: () => fetchMyBookings(page),
    placeholderData: keepPreviousData,
  });
}

export function useBooking(code: string) {
  return useQuery({
    queryKey: bookingKeys.detail(code),
    queryFn: () => fetchBooking(code),
    // A missing booking won't appear on retry
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

export function useCreateBooking(hotelSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...bookingKeys.all, "create"],
    mutationFn: createBooking,
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(booking.code), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: availabilityPrefix(hotelSlug) });
      void queryClient.invalidateQueries({ queryKey: hotelKeys.lists() });
    },
    onError: (error) => {
      // The last room may be gone: show fresh availability
      if (error instanceof ApiError && error.code === "ROOM_UNAVAILABLE") {
        void queryClient.invalidateQueries({ queryKey: availabilityPrefix(hotelSlug) });
      }
    },
  });
}

export function useCancelBooking(hotelSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...bookingKeys.all, "cancel"],
    mutationFn: cancelBooking,
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(booking.code), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: availabilityPrefix(hotelSlug) });
      void queryClient.invalidateQueries({ queryKey: hotelKeys.lists() });
    },
    onError: (_error, code) => {
      // Not cancellable any more (expired, past the cut-off): show the booking's real state
      void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(code) });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}
