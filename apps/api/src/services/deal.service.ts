import { BOOKING_TZ, todayIn, type Deal } from "@booking/shared";
import { fromDbDate, toDbDate } from "../lib/dates";
import { imageOrder } from "../lib/image-order";
import { prisma } from "../lib/prisma";
import { promotionRuleSelect } from "../lib/promotions";
import { discountedPrice } from "./pricing.service";

const DEALS_LIMIT = 100;

/**
 * Active deals of active hotels that can be booked today (BOOKING_TZ), best discount first. A hotel without
 * an active room type has nothing to sell, so its deals are left out.
 */
export async function listDeals(now: Date = new Date()): Promise<Deal[]> {
  const today = toDbDate(todayIn(BOOKING_TZ, now));
  const rows = await prisma.promotion.findMany({
    where: {
      isActive: true,
      hotel: { isActive: true, roomTypes: { some: { isActive: true } } },
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: today } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: today } }] },
      ],
    },
    orderBy: [{ percentOff: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: DEALS_LIMIT,
    select: {
      ...promotionRuleSelect,
      hotel: {
        select: {
          name: true,
          slug: true,
          city: true,
          ratingAvg: true,
          reviewCount: true,
          currency: true,
          images: { select: { url: true, alt: true }, orderBy: [...imageOrder], take: 1 },
          roomTypes: {
            where: { isActive: true },
            select: { basePrice: true },
            orderBy: [{ basePrice: "asc" }],
            take: 1,
          },
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const { hotel } = row;
    const cheapest = hotel.roomTypes[0];
    if (!cheapest) return [];
    return [
      {
        id: row.id,
        name: row.name,
        type: row.type,
        percentOff: row.percentOff,
        minNights: row.minNights,
        minDaysAhead: row.minDaysAhead,
        maxDaysAhead: row.maxDaysAhead,
        code: row.code,
        validUntil: row.validUntil ? fromDbDate(row.validUntil) : null,
        hotel: {
          name: hotel.name,
          slug: hotel.slug,
          city: hotel.city,
          ratingAvg: hotel.ratingAvg,
          reviewCount: hotel.reviewCount,
          coverImage: hotel.images[0] ?? null,
          currency: hotel.currency,
          fromPrice: cheapest.basePrice.toNumber(),
          discountedFromPrice: discountedPrice(cheapest.basePrice, row.percentOff).toNumber(),
        },
      },
    ];
  });
}
