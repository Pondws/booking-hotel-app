"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminReviewListQuery, UpdateReviewVisibilityInput } from "@booking/shared";
import { fetchAdminReviews, updateReviewVisibility } from "./api";

export const adminReviewKeys = {
  all: ["admin-reviews"] as const,
  lists: () => [...adminReviewKeys.all, "list"] as const,
  list: (query: AdminReviewListQuery) => [...adminReviewKeys.lists(), query] as const,
};

export function useAdminReviews(query: AdminReviewListQuery) {
  return useQuery({
    queryKey: adminReviewKeys.list(query),
    queryFn: () => fetchAdminReviews(query),
    placeholderData: keepPreviousData,
  });
}

/** Hide or show one review. The lists refetch either way: on a refusal the row may have changed elsewhere. */
export function useSetReviewVisibility(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReviewVisibilityInput) => updateReviewVisibility(id, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminReviewKeys.lists() }),
  });
}
