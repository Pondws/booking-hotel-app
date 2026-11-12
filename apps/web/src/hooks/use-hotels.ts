"use client";

import { useQuery } from "@tanstack/react-query";
import { healthSchema, hotelListSchema } from "@booking/shared";
import { apiFetch } from "@/lib/api";

export const queryKeys = {
  health: ["health"] as const,
  hotels: ["hotels"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiFetch("/api/health", healthSchema),
  });
}

export function useHotels() {
  return useQuery({
    queryKey: queryKeys.hotels,
    queryFn: () => apiFetch("/api/hotels", hotelListSchema),
  });
}
