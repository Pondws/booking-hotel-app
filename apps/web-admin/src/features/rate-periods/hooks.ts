"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RatePeriodInput } from "@booking/shared";
import { adminRoomTypeKeys } from "@/features/room-types/hooks";
import { createRatePeriod, deleteRatePeriod, fetchRatePeriods, updateRatePeriod } from "./api";

export const adminRatePeriodKeys = {
  all: ["admin-rate-periods"] as const,
  list: (hotelId: string, roomTypeId: string) => [...adminRatePeriodKeys.all, hotelId, roomTypeId] as const,
};

export function useRatePeriods(hotelId: string, roomTypeId: string) {
  return useQuery({
    queryKey: adminRatePeriodKeys.list(hotelId, roomTypeId),
    queryFn: () => fetchRatePeriods(hotelId, roomTypeId),
  });
}

/** Refresh the list and the room type (its `deletable` depends on having rate periods). */
function refresh(queryClient: QueryClient, hotelId: string, roomTypeId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminRatePeriodKeys.list(hotelId, roomTypeId) }),
    queryClient.invalidateQueries({ queryKey: adminRoomTypeKeys.detail(hotelId, roomTypeId) }),
  ]);
}

export function useCreateRatePeriod(hotelId: string, roomTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RatePeriodInput) => createRatePeriod(hotelId, roomTypeId, input),
    onSuccess: () => refresh(queryClient, hotelId, roomTypeId),
  });
}

export function useUpdateRatePeriod(hotelId: string, roomTypeId: string, ratePeriodId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RatePeriodInput) => updateRatePeriod(hotelId, roomTypeId, ratePeriodId, input),
    onSuccess: () => refresh(queryClient, hotelId, roomTypeId),
  });
}

export function useDeleteRatePeriod(hotelId: string, roomTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ratePeriodId: string) => deleteRatePeriod(hotelId, roomTypeId, ratePeriodId),
    onSuccess: () => refresh(queryClient, hotelId, roomTypeId),
  });
}
