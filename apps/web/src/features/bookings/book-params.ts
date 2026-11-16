import { createBookingSchema, promoCodeField, type CreateBookingData } from "@booking/shared";

export type BookParams =
  | { hotel: string; input: CreateBookingData }
  | { hotel: string | null; input: null };

/**
 * `/book?hotel=&roomTypeId=&checkIn=&checkOut=&guests=&promo=&points=` → validated booking input, or
 * `input: null`. A malformed `promo` / `points` is dropped rather than failing the whole stay.
 */
export function parseBookParams(sp: URLSearchParams): BookParams {
  const hotel = sp.get("hotel")?.trim() || null;
  const parsed = createBookingSchema.safeParse({
    roomTypeId: sp.get("roomTypeId") ?? undefined,
    checkIn: sp.get("checkIn") ?? undefined,
    checkOut: sp.get("checkOut") ?? undefined,
    guests: sp.get("guests") ?? undefined,
  });
  if (hotel === null || !parsed.success) return { hotel, input: null };
  const promo = promoCodeField.safeParse(sp.get("promo") ?? "");
  const points = Number(sp.get("points") ?? 0);
  return {
    hotel,
    input: {
      ...parsed.data,
      promoCode: promo.success ? promo.data : undefined,
      pointsToRedeem: Number.isInteger(points) && points > 0 ? points : undefined,
    },
  };
}

/** `/book` URL for a room type and stay. */
export function bookHref(
  hotelSlug: string,
  stay: { roomTypeId: string; checkIn: string; checkOut: string; guests: number },
): string {
  const sp = new URLSearchParams({
    hotel: hotelSlug,
    roomTypeId: stay.roomTypeId,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: String(stay.guests),
  });
  return `/book?${sp.toString()}`;
}
