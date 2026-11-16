import type { Destination } from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { imageOrder } from "../lib/image-order";
import { prisma } from "../lib/prisma";

/**
 * Every city with at least one active hotel. Grouped in memory: one query, and the catalog is small
 * (revisit with a GROUP BY if it grows to thousands of hotels).
 * Cover = the best-rated hotel's first photo. fromPrice is per currency — a city's hotels share one in practice;
 * the cheapest hotel's currency wins.
 */
export async function listDestinations(): Promise<Destination[]> {
  const hotels = await prisma.hotel.findMany({
    where: { isActive: true },
    orderBy: [{ ratingAvg: "desc" }, { name: "asc" }, { id: "asc" }],
    select: {
      city: true,
      currency: true,
      images: { select: { url: true, alt: true }, orderBy: [...imageOrder], take: 1 },
      roomTypes: { where: { isActive: true }, select: { basePrice: true } },
    },
  });

  const byCity = new Map<string, { hotelCount: number; cheapest: Prisma.Decimal | null; currency: string; coverImage: Destination["coverImage"] }>();
  for (const h of hotels) {
    const city = h.city.trim();
    const price = h.roomTypes.length === 0 ? null : Prisma.Decimal.min(...h.roomTypes.map((rt) => rt.basePrice));
    const entry = byCity.get(city);
    if (!entry) {
      byCity.set(city, { hotelCount: 1, cheapest: price, currency: h.currency, coverImage: h.images[0] ?? null });
      continue;
    }
    entry.hotelCount += 1;
    entry.coverImage ??= h.images[0] ?? null;
    if (price !== null && (entry.cheapest === null || price.lessThan(entry.cheapest))) {
      entry.cheapest = price;
      entry.currency = h.currency;
    }
  }

  return [...byCity]
    .map(([city, e]) => ({
      city,
      hotelCount: e.hotelCount,
      fromPrice: e.cheapest === null ? null : e.cheapest.toDecimalPlaces(2).toNumber(),
      currency: e.currency,
      coverImage: e.coverImage,
    }))
    .sort((a, b) => b.hotelCount - a.hotelCount || a.city.localeCompare(b.city));
}
