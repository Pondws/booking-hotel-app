"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WishlistInput, WishlistSummary } from "@booking/shared";
import { useMe } from "@/features/auth/hooks";
import {
  createWishlist,
  deleteWishlist,
  fetchWishlist,
  fetchWishlists,
  renameWishlist,
  saveHotel,
  unsaveHotel,
} from "./api";

export const wishlistKeys = {
  all: ["wishlists"] as const,
  list: () => [...wishlistKeys.all, "list"] as const,
  detail: (wishlistId: string) => [...wishlistKeys.all, "detail", wishlistId] as const,
};

/** The signed-in user's lists; idle (no request) when signed out, so hearts on public pages cost nothing. */
export function useWishlists() {
  const { data: me } = useMe();
  return useQuery({ queryKey: wishlistKeys.list(), queryFn: fetchWishlists, enabled: !!me });
}

/** Hotel ids saved in any list (the filled hearts). */
export function useSavedHotelIds(): Set<string> {
  const { data } = useWishlists();
  return new Set(data?.flatMap((l) => l.hotelIds) ?? []);
}

export function useWishlist(wishlistId: string) {
  return useQuery({ queryKey: wishlistKeys.detail(wishlistId), queryFn: () => fetchWishlist(wishlistId) });
}

// Every write can change the hearts, the overview and a detail page: refresh the whole family.
function useInvalidateWishlists() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
}

export function useCreateWishlist() {
  const invalidate = useInvalidateWishlists();
  return useMutation({ mutationFn: (input: WishlistInput) => createWishlist(input), onSuccess: invalidate });
}

export function useRenameWishlist(wishlistId: string) {
  const invalidate = useInvalidateWishlists();
  return useMutation({
    mutationFn: (input: WishlistInput) => renameWishlist(wishlistId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteWishlist(wishlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteWishlist(wishlistId),
    // Only the overview: refetching the open detail page would flash a 404 before it navigates away.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wishlistKeys.list() }),
  });
}

type Toggle = { wishlistId: string; hotelId: string; saved: boolean };

/** Save / unsave one hotel in one list. Optimistic on the list cache so the heart reacts at once. */
export function useToggleSaved() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wishlistId, hotelId, saved }: Toggle) =>
      saved ? saveHotel(wishlistId, hotelId) : unsaveHotel(wishlistId, hotelId),
    onMutate: async ({ wishlistId, hotelId, saved }) => {
      await queryClient.cancelQueries({ queryKey: wishlistKeys.list() });
      const previous = queryClient.getQueryData<WishlistSummary[]>(wishlistKeys.list());
      queryClient.setQueryData<WishlistSummary[]>(wishlistKeys.list(), (lists) =>
        lists?.map((l) =>
          l.id !== wishlistId
            ? l
            : {
                ...l,
                hotelIds: saved
                  ? [hotelId, ...l.hotelIds.filter((id) => id !== hotelId)]
                  : l.hotelIds.filter((id) => id !== hotelId),
              },
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(wishlistKeys.list(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: wishlistKeys.all }),
  });
}
