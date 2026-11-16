"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateReviewData } from "@booking/shared";
import { ApiError } from "@/lib/api";
import { hotelKeys } from "@/features/hotels/hooks";
import { rewardKeys } from "@/features/rewards/hooks";
import { cancelBooking, createBooking, createReview, fetchBooking, fetchMyBookings } from "./api";

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

/** `poll`: refetch every 2 s until the booking is CONFIRMED (waiting for the payment webhook). */
export function useBooking(code: string, { poll = false }: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: bookingKeys.detail(code),
    queryFn: () => fetchBooking(code),
    refetchInterval: (query) => (poll && query.state.data?.status !== "CONFIRMED" ? 2000 : false),
  });
}

export function useCreateBooking(hotelSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...bookingKeys.all, "create"],
    mutationFn: createBooking,
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(booking.code), booking);
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
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

export function useCreateReview(code: string, hotelSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...bookingKeys.all, "review"],
    mutationFn: (input: CreateReviewData) => createReview(code, input),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(booking.code), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      // The hotel's rating average + review count changed
      void queryClient.invalidateQueries({ queryKey: hotelKeys.detail(hotelSlug), exact: true });
      void queryClient.invalidateQueries({ queryKey: hotelKeys.lists() });
    },
    onError: (error) => {
      // Already reviewed / not reviewable any more: show the booking as the server has it
      if (error instanceof ApiError && error.code === "CONFLICT") {
        void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(code) });
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
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: availabilityPrefix(hotelSlug) });
      void queryClient.invalidateQueries({ queryKey: hotelKeys.lists() });
    },
  });
}
