"use client";

import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { HotelSearchQuery, StayRange } from "@booking/shared";
import { fetchAvailability, fetchHotel, searchHotels } from "./api";

export const hotelKeys = {
  all: ["hotels"] as const,
  lists: () => [...hotelKeys.all, "list"] as const,
  list: (q: HotelSearchQuery) => [...hotelKeys.lists(), q] as const,
  details: () => [...hotelKeys.all, "detail"] as const,
  detail: (slug: string) => [...hotelKeys.details(), slug] as const,
  availability: (slug: string, range: StayRange) =>
    [...hotelKeys.detail(slug), "availability", range] as const,
};

const hotelDetailOptions = (slug: string) =>
  queryOptions({ queryKey: hotelKeys.detail(slug), queryFn: () => fetchHotel(slug) });

export function useHotelSearch(q: HotelSearchQuery) {
  return useQuery({
    queryKey: hotelKeys.list(q),
    queryFn: () => searchHotels(q),
    placeholderData: keepPreviousData,
  });
}

export function useHotel(slug: string) {
  return useQuery(hotelDetailOptions(slug));
}

/** Only fetches when `range` is a valid stay; prices change with bookings, so keep them fresher. */
export function useAvailability(slug: string, range: StayRange | null) {
  return useQuery({
    queryKey: range ? hotelKeys.availability(slug, range) : [...hotelKeys.detail(slug), "availability"],
    queryFn: () => {
      if (!range) throw new Error("Availability needs a stay range");
      return fetchAvailability(slug, range);
    },
    enabled: range !== null,
    staleTime: 30_000,
  });
}

/** Warms the detail cache, e.g. when a hotel card is hovered or focused. */
export function usePrefetchHotel(): (slug: string) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (slug: string) => {
      void queryClient.prefetchQuery(hotelDetailOptions(slug));
    },
    [queryClient],
  );
}
