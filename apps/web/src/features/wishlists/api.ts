import {
  wishlistDetailSchema,
  wishlistListSchema,
  wishlistSummarySchema,
  type WishlistDetail,
  type WishlistInput,
  type WishlistSummary,
} from "@booking/shared";
import { request, requestNoContent } from "@/lib/api";

const listUrl = (wishlistId: string) => `/api/wishlists/${encodeURIComponent(wishlistId)}`;
const itemUrl = (wishlistId: string, hotelId: string) =>
  `${listUrl(wishlistId)}/hotels/${encodeURIComponent(hotelId)}`;

export function fetchWishlists(): Promise<WishlistSummary[]> {
  return request(wishlistListSchema, { method: "GET", url: "/api/wishlists" });
}

export function fetchWishlist(wishlistId: string): Promise<WishlistDetail> {
  return request(wishlistDetailSchema, { method: "GET", url: listUrl(wishlistId) });
}

export function createWishlist(input: WishlistInput): Promise<WishlistSummary> {
  return request(wishlistSummarySchema, { method: "POST", url: "/api/wishlists", data: input });
}

export function renameWishlist(wishlistId: string, input: WishlistInput): Promise<WishlistSummary> {
  return request(wishlistSummarySchema, { method: "PATCH", url: listUrl(wishlistId), data: input });
}

export function deleteWishlist(wishlistId: string) {
  return requestNoContent({ method: "DELETE", url: listUrl(wishlistId) });
}

export function saveHotel(wishlistId: string, hotelId: string) {
  return requestNoContent({ method: "PUT", url: itemUrl(wishlistId, hotelId) });
}

export function unsaveHotel(wishlistId: string, hotelId: string) {
  return requestNoContent({ method: "DELETE", url: itemUrl(wishlistId, hotelId) });
}
