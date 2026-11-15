"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AdminAmenity, AmenityScope, CreateAmenityInput, UpdateAmenityInput } from "@booking/shared";
import { adminHotelKeys } from "@/features/hotels/hooks";
import { adminRoomTypeKeys } from "@/features/room-types/hooks";
import { createAmenity, deleteAmenity, fetchAmenities, fetchAmenity, updateAmenity } from "./api";

export const amenityKeys = {
  all: ["amenities"] as const,
  lists: () => [...amenityKeys.all, "list"] as const,
  list: (scope?: AmenityScope) => [...amenityKeys.lists(), scope ?? "all"] as const,
  detail: (id: string) => [...amenityKeys.all, "detail", id] as const,
};

export function useAmenities(scope?: AmenityScope) {
  return useQuery({
    queryKey: amenityKeys.list(scope),
    queryFn: () => fetchAmenities(scope),
    staleTime: 5 * 60_000,
  });
}

export function useAmenity(id: string) {
  return useQuery({ queryKey: amenityKeys.detail(id), queryFn: () => fetchAmenity(id) });
}

/** Hotel and room type details embed amenity names, so they refresh with the catalog. */
function refresh(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: amenityKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: adminHotelKeys.all }),
    queryClient.invalidateQueries({ queryKey: adminRoomTypeKeys.all }),
  ]);
}

function store(queryClient: QueryClient, amenity: AdminAmenity) {
  queryClient.setQueryData(amenityKeys.detail(amenity.id), amenity);
  return refresh(queryClient);
}

export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAmenityInput) => createAmenity(input),
    onSuccess: (created) => store(queryClient, created),
  });
}

export function useUpdateAmenity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAmenityInput) => updateAmenity(id, input),
    onSuccess: (updated) => store(queryClient, updated),
  });
}

export function useDeleteAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAmenity(id),
    // Drop the detail first: refetching it on the page being left would flash "not found"
    onSuccess: (_void, id) => {
      queryClient.removeQueries({ queryKey: amenityKeys.detail(id) });
      return refresh(queryClient);
    },
  });
}
