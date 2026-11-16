"use client";

import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import type { AvailabilityQuery, HotelSearchQuery } from "@booking/shared";
import { fetchAvailability, fetchHotel, fetchHotelAmenities, fetchHotelReviews, searchHotels } from "./api";

const REVIEWS_PAGE_SIZE = 10;

export const hotelKeys = {
  all: ["hotels"] as const,
  lists: () => [...hotelKeys.all, "list"] as const,
  amenities: () => [...hotelKeys.all, "amenities"] as const,
  list: (q: HotelSearchQuery) => [...hotelKeys.lists(), q] as const,
  details: () => [...hotelKeys.all, "detail"] as const,
  detail: (slug: string) => [...hotelKeys.details(), slug] as const,
  availability: (slug: string, range: AvailabilityQuery) =>
    [...hotelKeys.detail(slug), "availability", range] as const,
  // Under the detail key, so invalidating a hotel (e.g. after writing a review) refreshes its reviews too.
  reviews: (slug: string) => [...hotelKeys.detail(slug), "reviews"] as const,
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
export function useAvailability(slug: string, range: AvailabilityQuery | null) {
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

/** Visible reviews, newest first, one page at a time ("Show more"). */
export function useHotelReviews(slug: string) {
  return useInfiniteQuery({
    queryKey: hotelKeys.reviews(slug),
    queryFn: ({ pageParam }) => fetchHotelReviews(slug, { page: pageParam, pageSize: REVIEWS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
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

/** The filter's amenity options change rarely (admin catalog), so keep them for a while. */
export function useHotelAmenities() {
  return useQuery({ queryKey: hotelKeys.amenities(), queryFn: fetchHotelAmenities, staleTime: 30 * 60_000 });
}
