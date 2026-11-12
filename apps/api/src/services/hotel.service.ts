import {
  nightsBetween,
  type Availability,
  type CreateHotelData,
  type HotelDetail,
  type HotelSearchQuery,
  type HotelSummary,
  type Paginated,
  type StayRange,
} from "@booking/shared";
import { Prisma, type Hotel } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { prisma } from "../lib/prisma";
import { toSlug, withSuffix } from "../lib/slug";
import { availableRoomCounts, blockingBookingWhere } from "./availability.service";
import { quoteStays } from "./pricing.service";

export type { Hotel };

const hotelNotFound = () => new AppError(404, "NOT_FOUND", "Hotel not found");

const imageSelect = { url: true, alt: true } as const;
const imageOrder = [{ sortOrder: "asc" }, { id: "asc" }] as const;
const amenitySelect = { amenity: { select: { code: true, name: true } } } as const;
const amenityOrder = { amenity: { name: "asc" } } as const;

// ---------- Search ----------

type PricedRoomType = { id: string; basePrice: Prisma.Decimal };
type PricedHotel = { id: string; currency: string; roomTypes: PricedRoomType[] };

function minPrice(values: Prisma.Decimal[]): number | null {
  if (values.length === 0) return null;
  return Prisma.Decimal.min(...values)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Lowest nightly price per hotel. Without dates: lowest base price of the matching room types.
 * With dates: lowest quote total / nights among room types that still have a free room.
 * One availability query and (per currency) one rate-period query for the whole page.
 */
async function fromPrices(
  hotels: PricedHotel[],
  checkIn: string | undefined,
  checkOut: string | undefined,
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (checkIn === undefined || checkOut === undefined) {
    for (const h of hotels) result.set(h.id, minPrice(h.roomTypes.map((rt) => rt.basePrice)));
    return result;
  }

  const counts = await availableRoomCounts(
    hotels.flatMap((h) => h.roomTypes.map((rt) => rt.id)),
    checkIn,
    checkOut,
  );
  const available = new Map(
    hotels.map((h) => [h.id, h.roomTypes.filter((rt) => (counts.get(rt.id) ?? 0) > 0)]),
  );

  const byCurrency = new Map<string, PricedRoomType[]>();
  for (const h of hotels) {
    byCurrency.set(h.currency, [...(byCurrency.get(h.currency) ?? []), ...(available.get(h.id) ?? [])]);
  }
  const quoted = await Promise.all(
    [...byCurrency].map(([currency, rts]) => quoteStays(rts, currency, checkIn, checkOut)),
  );
  const quotes = new Map(quoted.flatMap((m) => [...m]));

  for (const h of hotels) {
    const nightly = (available.get(h.id) ?? []).flatMap((rt) => {
      const q = quotes.get(rt.id);
      return q ? [new Prisma.Decimal(q.total).div(q.nights)] : [];
    });
    result.set(h.id, minPrice(nightly));
  }
  return result;
}

export async function searchHotels(query: HotelSearchQuery): Promise<Paginated<HotelSummary>> {
  const { city, checkIn, checkOut, guests, page, pageSize } = query;

  const roomTypeWhere: Prisma.RoomTypeWhereInput = {
    isActive: true,
    ...(guests !== undefined && { capacity: { gte: guests } }),
  };
  const freeRooms: Prisma.RoomTypeWhereInput =
    checkIn !== undefined && checkOut !== undefined
      ? {
          rooms: {
            some: { isActive: true, bookings: { none: blockingBookingWhere(checkIn, checkOut) } },
          },
        }
      : {};
  const filtersRoomTypes = guests !== undefined || checkIn !== undefined;
  const where: Prisma.HotelWhereInput = {
    isActive: true,
    ...(city !== undefined && { city: { contains: city, mode: "insensitive" } }),
    ...(filtersRoomTypes && { roomTypes: { some: { ...roomTypeWhere, ...freeRooms } } }),
  };

  const [total, hotels] = await prisma.$transaction([
    prisma.hotel.count({ where }),
    prisma.hotel.findMany({
      where,
      orderBy: [{ ratingAvg: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        currency: true,
        ratingAvg: true,
        reviewCount: true,
        images: { select: imageSelect, orderBy: [...imageOrder], take: 1 },
        roomTypes: { where: roomTypeWhere, select: { id: true, basePrice: true } },
      },
    }),
  ]);

  const prices = await fromPrices(hotels, checkIn, checkOut);
  return {
    items: hotels.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      city: h.city,
      currency: h.currency,
      ratingAvg: h.ratingAvg,
      reviewCount: h.reviewCount,
      coverImage: h.images[0] ?? null,
      fromPrice: prices.get(h.id) ?? null,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ---------- Detail ----------

export async function getHotelBySlug(slug: string): Promise<HotelDetail> {
  const hotel = await prisma.hotel.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      address: true,
      description: true,
      currency: true,
      ratingAvg: true,
      reviewCount: true,
      images: { select: imageSelect, orderBy: [...imageOrder] },
      amenities: { select: amenitySelect, orderBy: amenityOrder },
      roomTypes: {
        where: { isActive: true },
        orderBy: [{ basePrice: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          capacity: true,
          basePrice: true,
          images: { select: imageSelect, orderBy: [...imageOrder] },
          amenities: { select: amenitySelect, orderBy: amenityOrder },
        },
      },
    },
  });
  if (!hotel) throw hotelNotFound();

  return {
    ...hotel,
    amenities: hotel.amenities.map((a) => a.amenity),
    roomTypes: hotel.roomTypes.map((rt) => ({
      ...rt,
      basePrice: rt.basePrice.toNumber(),
      amenities: rt.amenities.map((a) => a.amenity),
    })),
  };
}

// ---------- Availability ----------

export async function getAvailability(slug: string, range: StayRange): Promise<Availability> {
  const { checkIn, checkOut, guests } = range;
  const hotel = await prisma.hotel.findFirst({
    where: { slug, isActive: true },
    select: {
      currency: true,
      roomTypes: {
        where: { isActive: true, capacity: { gte: guests } },
        orderBy: [{ basePrice: "asc" }, { name: "asc" }],
        select: { id: true, basePrice: true },
      },
    },
  });
  if (!hotel) throw hotelNotFound();

  const [counts, quotes] = await Promise.all([
    availableRoomCounts(
      hotel.roomTypes.map((rt) => rt.id),
      checkIn,
      checkOut,
    ),
    quoteStays(hotel.roomTypes, hotel.currency, checkIn, checkOut),
  ]);

  return {
    checkIn,
    checkOut,
    guests,
    nights: nightsBetween(checkIn, checkOut),
    roomTypes: hotel.roomTypes.flatMap((rt) => {
      const quote = quotes.get(rt.id);
      if (!quote) return [];
      const availableRooms = counts.get(rt.id) ?? 0;
      return [{ roomTypeId: rt.id, available: availableRooms > 0, availableRooms, quote }];
    }),
  };
}

// ---------- Admin create ----------

async function nextSlug(name: string): Promise<string> {
  const base = toSlug(name);
  const existing = await prisma.hotel.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  return withSuffix(
    base,
    existing.map((h) => h.slug),
  );
}

export async function createHotel(input: CreateHotelData): Promise<Hotel> {
  try {
    return await prisma.hotel.create({ data: { ...input, slug: await nextSlug(input.name) } });
  } catch (err) {
    // Lost a slug race (P2002 on slug only; other violations propagate) with a concurrent create: recompute once and retry.
    // A second P2002 propagates and becomes 409 CONFLICT.
    if (isUniqueViolationOn(err, "slug")) {
      return prisma.hotel.create({ data: { ...input, slug: await nextSlug(input.name) } });
    }
    throw err;
  }
}
