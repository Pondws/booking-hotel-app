"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { AdminHotel, AdminHotelListQuery, HotelContentInput } from "@booking/shared";
import { createHotel, fetchAdminHotel, fetchAdminHotels, saveHotel, setHotelStatus } from "./api";

export const adminHotelKeys = {
  all: ["admin-hotels"] as const,
  lists: () => [...adminHotelKeys.all, "list"] as const,
  list: (query: AdminHotelListQuery) => [...adminHotelKeys.lists(), query] as const,
  detail: (id: string) => [...adminHotelKeys.all, "detail", id] as const,
};

export function useAdminHotels(query: AdminHotelListQuery) {
  return useQuery({
    queryKey: adminHotelKeys.list(query),
    queryFn: () => fetchAdminHotels(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminHotel(id: string) {
  return useQuery({ queryKey: adminHotelKeys.detail(id), queryFn: () => fetchAdminHotel(id) });
}

/** Every write returns the full detail: put it in the cache and refresh the lists. */
function storeHotel(queryClient: QueryClient, hotel: AdminHotel) {
  queryClient.setQueryData(adminHotelKeys.detail(hotel.id), hotel);
  return queryClient.invalidateQueries({ queryKey: adminHotelKeys.lists() });
}

export function useCreateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHotel,
    onSuccess: (hotel) => storeHotel(queryClient, hotel),
  });
}

export function useSaveHotel(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HotelContentInput) => saveHotel(id, input),
    onSuccess: (hotel) => storeHotel(queryClient, hotel),
  });
}

export function useSetHotelStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) => setHotelStatus(id, isActive),
    onSuccess: (hotel) => storeHotel(queryClient, hotel),
  });
}
