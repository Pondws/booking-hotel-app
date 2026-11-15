"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AmenityScope, CreateAmenityInput, UpdateAmenityInput } from "@booking/shared";
import { adminHotelKeys } from "@/features/hotels/hooks";
import { adminRoomTypeKeys } from "@/features/room-types/hooks";
import { createAmenity, deleteAmenity, fetchAmenities, updateAmenity } from "./api";

export const amenityKeys = {
  all: ["amenities"] as const,
  list: (scope?: AmenityScope) => [...amenityKeys.all, "list", scope ?? "all"] as const,
};

export function useAmenities(scope?: AmenityScope) {
  return useQuery({
    queryKey: amenityKeys.list(scope),
    queryFn: () => fetchAmenities(scope),
    staleTime: 5 * 60_000,
  });
}

/** Hotel and room type details embed amenity names, so they refresh with the catalog. */
function refresh(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: amenityKeys.all }),
    queryClient.invalidateQueries({ queryKey: adminHotelKeys.all }),
    queryClient.invalidateQueries({ queryKey: adminRoomTypeKeys.all }),
  ]);
}

export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAmenityInput) => createAmenity(input),
    onSuccess: () => refresh(queryClient),
  });
}

export function useUpdateAmenity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAmenityInput) => updateAmenity(id, input),
    onSuccess: () => refresh(queryClient),
  });
}

export function useDeleteAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAmenity(id),
    onSuccess: () => refresh(queryClient),
  });
}
