import type { StayQuote } from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { toDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { priceNights, type PricePeriod } from "../lib/stay-pricing";

/** Quotes `[checkIn, checkOut)` for each room type with one rate-period query for all of them. */
export async function quoteStays(
  roomTypes: { id: string; basePrice: Prisma.Decimal }[],
  currency: string,
  checkIn: string,
  checkOut: string,
): Promise<Map<string, StayQuote>> {
  const quotes = new Map<string, StayQuote>();
  if (roomTypes.length === 0) return quotes;

  const periods = await prisma.ratePeriod.findMany({
    where: {
      roomTypeId: { in: roomTypes.map((rt) => rt.id) },
      startDate: { lt: toDbDate(checkOut) },
      endDate: { gt: toDbDate(checkIn) },
    },
    select: { roomTypeId: true, startDate: true, endDate: true, price: true },
  });
  const byRoomType = new Map<string, PricePeriod[]>();
  for (const { roomTypeId, ...period } of periods) {
    const list = byRoomType.get(roomTypeId) ?? [];
    list.push(period);
    byRoomType.set(roomTypeId, list);
  }

  for (const rt of roomTypes) {
    const priced = priceNights(rt.basePrice, byRoomType.get(rt.id) ?? [], checkIn, checkOut);
    quotes.set(rt.id, {
      nights: priced.nights,
      nightly: priced.nightly.map((n) => ({ date: n.date, price: n.price.toNumber() })),
      total: priced.total.toNumber(),
      currency,
    });
  }
  return quotes;
}

/** Quotes one active room type of an active hotel; 404 otherwise. */
export async function quoteStay(
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): Promise<StayQuote> {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, isActive: true, hotel: { isActive: true } },
    select: { id: true, basePrice: true, hotel: { select: { currency: true } } },
  });
  if (!roomType) throw new AppError(404, "NOT_FOUND", "Room type not found");

  const quotes = await quoteStays([roomType], roomType.hotel.currency, checkIn, checkOut);
  const quote = quotes.get(roomType.id);
  if (!quote) throw new AppError(404, "NOT_FOUND", "Room type not found");
  return quote;
}
