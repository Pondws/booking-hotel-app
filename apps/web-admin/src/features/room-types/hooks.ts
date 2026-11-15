"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AdminRoomType, RoomTypeInput, UpdateRoomInput } from "@booking/shared";
import {
  addRoom,
  createRoomType,
  deleteRoomType,
  fetchRoomType,
  fetchRoomTypes,
  saveRoomType,
  setRoomTypeStatus,
  updateRoom,
} from "./api";

export const adminRoomTypeKeys = {
  all: ["admin-room-types"] as const,
  hotel: (hotelId: string) => [...adminRoomTypeKeys.all, hotelId] as const,
  list: (hotelId: string) => [...adminRoomTypeKeys.hotel(hotelId), "list"] as const,
  detail: (hotelId: string, roomTypeId: string) =>
    [...adminRoomTypeKeys.hotel(hotelId), "detail", roomTypeId] as const,
};

export function useRoomTypes(hotelId: string) {
  return useQuery({ queryKey: adminRoomTypeKeys.list(hotelId), queryFn: () => fetchRoomTypes(hotelId) });
}

export function useRoomType(hotelId: string, roomTypeId: string) {
  return useQuery({
    queryKey: adminRoomTypeKeys.detail(hotelId, roomTypeId),
    queryFn: () => fetchRoomType(hotelId, roomTypeId),
  });
}

/** Every write returns the full room type: put it in the cache and refresh the hotel's list. */
function storeRoomType(queryClient: QueryClient, roomType: AdminRoomType) {
  queryClient.setQueryData(adminRoomTypeKeys.detail(roomType.hotel.id, roomType.id), roomType);
  return queryClient.invalidateQueries({ queryKey: adminRoomTypeKeys.list(roomType.hotel.id) });
}

export function useCreateRoomType(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomTypeInput) => createRoomType(hotelId, input),
    onSuccess: (roomType) => storeRoomType(queryClient, roomType),
  });
}

export function useSaveRoomType(hotelId: string, roomTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomTypeInput) => saveRoomType(hotelId, roomTypeId, input),
    onSuccess: (roomType) => storeRoomType(queryClient, roomType),
  });
}

export function useSetRoomTypeStatus(hotelId: string, roomTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) => setRoomTypeStatus(hotelId, roomTypeId, isActive),
    onSuccess: (roomType) => storeRoomType(queryClient, roomType),
  });
}

export function useDeleteRoomType(hotelId: string, roomTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteRoomType(hotelId, roomTypeId),
    // The detail page is still mounted until it navigates away, so its cache entry is left to expire
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminRoomTypeKeys.list(hotelId) }),
  });
}

export function useAddRoom(hotelId: string, roomTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: string) => addRoom(hotelId, roomTypeId, number),
    onSuccess: (roomType) => storeRoomType(queryClient, roomType),
  });
}

export function useUpdateRoom(hotelId: string, roomTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, input }: { roomId: string; input: UpdateRoomInput }) =>
      updateRoom(hotelId, roomTypeId, roomId, input),
    onSuccess: (roomType) => storeRoomType(queryClient, roomType),
  });
}
