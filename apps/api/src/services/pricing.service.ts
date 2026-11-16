import { BOOKING_TZ, nightsBetween, todayIn, type StayQuote } from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { toDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { bestPromotion, isEligible, percentOf, promotionRuleSelect, type PromotionRule } from "../lib/promotions";
import { priceNights, type PricePeriod } from "../lib/stay-pricing";

export type QuoteOptions = {
  /** Also consider this hotel's code deal with this (normalised, uppercase) code. */
  promoCode?: string;
  /** Decides the booking day for the deal rules. */
  now?: Date;
};

type QuotableRoomType = { id: string; basePrice: Prisma.Decimal; hotelId: string };

/** Active deals of these hotels: the automatic ones, plus the code deal matching `promoCode`. */
async function promotionsByHotel(hotelIds: string[], promoCode: string | undefined) {
  const rows = await prisma.promotion.findMany({
    where: {
      hotelId: { in: hotelIds },
      isActive: true,
      OR: [{ code: null }, ...(promoCode ? [{ code: promoCode }] : [])],
    },
    select: { ...promotionRuleSelect, hotelId: true },
  });
  const byHotel = new Map<string, PromotionRule[]>();
  for (const { hotelId, ...rule } of rows) byHotel.set(hotelId, [...(byHotel.get(hotelId) ?? []), rule]);
  return byHotel;
}

/**
 * Quotes `[checkIn, checkOut)` for each room type with one rate-period query and one deal query for all of
 * them. The best eligible deal of the room type's hotel comes off the subtotal (deals never stack).
 */
export async function quoteStays(
  roomTypes: QuotableRoomType[],
  currency: string,
  checkIn: string,
  checkOut: string,
  opts: QuoteOptions = {},
): Promise<Map<string, StayQuote>> {
  const quotes = new Map<string, StayQuote>();
  if (roomTypes.length === 0) return quotes;

  const [periods, deals] = await Promise.all([
    prisma.ratePeriod.findMany({
      where: {
        roomTypeId: { in: roomTypes.map((rt) => rt.id) },
        startDate: { lt: toDbDate(checkOut) },
        endDate: { gt: toDbDate(checkIn) },
      },
      select: { roomTypeId: true, startDate: true, endDate: true, price: true },
    }),
    promotionsByHotel([...new Set(roomTypes.map((rt) => rt.hotelId))], opts.promoCode),
  ]);
  const byRoomType = new Map<string, PricePeriod[]>();
  for (const { roomTypeId, ...period } of periods) {
    const list = byRoomType.get(roomTypeId) ?? [];
    list.push(period);
    byRoomType.set(roomTypeId, list);
  }

  const stay = { today: todayIn(BOOKING_TZ, opts.now), checkIn, nights: nightsBetween(checkIn, checkOut) };
  for (const rt of roomTypes) {
    const priced = priceNights(rt.basePrice, byRoomType.get(rt.id) ?? [], checkIn, checkOut);
    const deal = bestPromotion(deals.get(rt.hotelId) ?? [], stay);
    const amount = deal ? percentOf(priced.total, deal.percentOff) : new Prisma.Decimal(0);
    quotes.set(rt.id, {
      nights: priced.nights,
      nightly: priced.nightly.map((n) => ({ date: n.date, price: n.price.toNumber() })),
      subtotal: priced.total.toNumber(),
      discount: deal
        ? {
            promotionId: deal.id,
            name: deal.name,
            type: deal.type,
            percentOff: deal.percentOff,
            code: deal.code,
            amount: amount.toNumber(),
          }
        : null,
      total: priced.total.minus(amount).toNumber(),
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
  opts: QuoteOptions = {},
): Promise<StayQuote> {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, isActive: true, hotel: { isActive: true } },
    select: { id: true, basePrice: true, hotelId: true, hotel: { select: { currency: true } } },
  });
  if (!roomType) throw new AppError(404, "NOT_FOUND", "Room type not found");

  const quotes = await quoteStays([roomType], roomType.hotel.currency, checkIn, checkOut, opts);
  const quote = quotes.get(roomType.id);
  if (!quote) throw new AppError(404, "NOT_FOUND", "Room type not found");
  return quote;
}

/** True when `code` is an active code deal of the hotel whose conditions this stay meets. */
export async function isPromoCodeValid(
  hotelId: string,
  code: string,
  checkIn: string,
  checkOut: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rule = await prisma.promotion.findFirst({
    where: { hotelId, code, isActive: true },
    select: promotionRuleSelect,
  });
  return (
    rule !== null &&
    isEligible(rule, { today: todayIn(BOOKING_TZ, now), checkIn, nights: nightsBetween(checkIn, checkOut) })
  );
}

/** A nightly price after `percentOff` — the deals page's "from" price. */
export function discountedPrice(price: Prisma.Decimal, percentOff: number): Prisma.Decimal {
  return price.minus(percentOf(price, percentOff));
}
