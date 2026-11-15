"use client";

import { useQuery } from "@tanstack/react-query";
import type { AmenityScope } from "@booking/shared";
import { fetchAmenities } from "./api";

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
