"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PromotionInput } from "@booking/shared";
import { createPromotion, deletePromotion, fetchPromotions, updatePromotion } from "./api";

export const adminPromotionKeys = {
  all: ["admin-promotions"] as const,
  list: (hotelId: string) => [...adminPromotionKeys.all, hotelId] as const,
};

export function usePromotions(hotelId: string) {
  return useQuery({ queryKey: adminPromotionKeys.list(hotelId), queryFn: () => fetchPromotions(hotelId) });
}

export function useCreatePromotion(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PromotionInput) => createPromotion(hotelId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminPromotionKeys.list(hotelId) }),
  });
}

export function useUpdatePromotion(hotelId: string, promotionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PromotionInput) => updatePromotion(hotelId, promotionId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminPromotionKeys.list(hotelId) }),
  });
}

export function useDeletePromotion(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) => deletePromotion(hotelId, promotionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminPromotionKeys.list(hotelId) }),
  });
}
