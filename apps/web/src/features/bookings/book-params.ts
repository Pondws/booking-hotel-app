import { createBookingSchema, type CreateBookingData } from "@booking/shared";

export type BookParams =
  | { hotel: string; input: CreateBookingData }
  | { hotel: string | null; input: null };

/** `/book?hotel=&roomTypeId=&checkIn=&checkOut=&guests=` → validated booking input, or `input: null`. */
export function parseBookParams(sp: URLSearchParams): BookParams {
  const hotel = sp.get("hotel")?.trim() || null;
  const parsed = createBookingSchema.safeParse({
    roomTypeId: sp.get("roomTypeId") ?? undefined,
    checkIn: sp.get("checkIn") ?? undefined,
    checkOut: sp.get("checkOut") ?? undefined,
    guests: sp.get("guests") ?? undefined,
  });
  if (hotel === null || !parsed.success) return { hotel, input: null };
  return { hotel, input: parsed.data };
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
