"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { AdminBooking, AdminBookingListQuery, CancelBookingInput } from "@booking/shared";
import {
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  fetchAdminBooking,
  fetchAdminBookings,
  fetchBookingRoomOptions,
  moveBookingRoom,
} from "./api";
import { adminDashboardKeys } from "@/features/dashboard/hooks";

export const adminBookingKeys = {
  all: ["admin-bookings"] as const,
  lists: () => [...adminBookingKeys.all, "list"] as const,
  list: (query: AdminBookingListQuery) => [...adminBookingKeys.lists(), query] as const,
  detail: (code: string) => [...adminBookingKeys.all, "detail", code] as const,
  rooms: (code: string) => [...adminBookingKeys.all, "rooms", code] as const,
};

export function useAdminBookings(query: AdminBookingListQuery) {
  return useQuery({
    queryKey: adminBookingKeys.list(query),
    queryFn: () => fetchAdminBookings(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminBooking(code: string) {
  return useQuery({ queryKey: adminBookingKeys.detail(code), queryFn: () => fetchAdminBooking(code) });
}

export function useBookingRoomOptions(code: string, enabled: boolean) {
  return useQuery({
    queryKey: adminBookingKeys.rooms(code),
    queryFn: () => fetchBookingRoomOptions(code),
    enabled,
  });
}

/** Every action returns the full booking: cache it, refresh the lists, the room options and the dashboard. */
function storeBooking(queryClient: QueryClient, booking: AdminBooking) {
  queryClient.setQueryData(adminBookingKeys.detail(booking.code), booking);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminBookingKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: adminBookingKeys.rooms(booking.code) }),
    queryClient.invalidateQueries({ queryKey: adminDashboardKeys.all }),
  ]);
}

/** A refused action (409) means the booking changed elsewhere — refetch it so the offered actions are right. */
function useBookingAction<TInput>(code: string, action: (input: TInput) => Promise<AdminBooking>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (booking) => storeBooking(queryClient, booking),
    onError: () => queryClient.invalidateQueries({ queryKey: adminBookingKeys.detail(code) }),
  });
}

export function useCheckIn(code: string) {
  return useBookingAction(code, () => checkInBooking(code));
}

export function useCheckOut(code: string) {
  return useBookingAction(code, () => checkOutBooking(code));
}

export function useCancelBooking(code: string) {
  return useBookingAction(code, (input: CancelBookingInput) => cancelBooking(code, input));
}

export function useMoveRoom(code: string) {
  return useBookingAction(code, (roomId: string) => moveBookingRoom(code, roomId));
}
