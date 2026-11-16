import {
  WISHLIST_ITEM_LIMIT,
  WISHLIST_LIMIT,
  type HotelSummary,
  type WishlistDetail,
  type WishlistSummary,
} from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { imageOrder } from "../lib/image-order";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { prisma } from "../lib/prisma";

// Every query is scoped by userId: another user's list is a 404, never a 403 (don't confirm it exists).
const notFound = () => new AppError(404, "NOT_FOUND", "Wishlist not found");

const activeItems = {
  where: { hotel: { isActive: true } },
  orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
} satisfies Prisma.Wishlist$itemsArgs;

const coverSelect = {
  select: { url: true as const, alt: true as const },
  orderBy: [...imageOrder],
  take: 1,
} satisfies Prisma.Hotel$imagesArgs;

function duplicateName(): AppError {
  const message = "A list with this name already exists";
  return new AppError(409, "CONFLICT", message, { formErrors: [], fieldErrors: { name: [message] } });
}

export async function listWishlists(userId: string): Promise<WishlistSummary[]> {
  const lists = await prisma.wishlist.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      createdAt: true,
      items: {
        ...activeItems,
        select: { hotelId: true, hotel: { select: { images: coverSelect } } },
      },
    },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    hotelIds: l.items.map((i) => i.hotelId),
    coverImage: l.items[0]?.hotel.images[0] ?? null,
    createdAt: l.createdAt.toISOString(),
  }));
}

async function summaryOf(userId: string, wishlistId: string): Promise<WishlistSummary> {
  const found = (await listWishlists(userId)).find((l) => l.id === wishlistId);
  if (!found) throw notFound();
  return found;
}

export async function getWishlist(userId: string, wishlistId: string): Promise<WishlistDetail> {
  const list = await prisma.wishlist.findFirst({
    where: { id: wishlistId, userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      items: {
        ...activeItems,
        select: {
          hotel: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              currency: true,
              ratingAvg: true,
              reviewCount: true,
              images: coverSelect,
              roomTypes: { where: { isActive: true }, select: { basePrice: true } },
            },
          },
        },
      },
    },
  });
  if (!list) throw notFound();
  const hotels: HotelSummary[] = list.items.map(({ hotel: h }) => {
    const prices = h.roomTypes.map((rt) => rt.basePrice);
    return {
      id: h.id,
      name: h.name,
      slug: h.slug,
      city: h.city,
      currency: h.currency,
      ratingAvg: h.ratingAvg,
      reviewCount: h.reviewCount,
      coverImage: h.images[0] ?? null,
      fromPrice: prices.length === 0 ? null : Prisma.Decimal.min(...prices).toDecimalPlaces(2).toNumber(),
    };
  });
  return { id: list.id, name: list.name, hotels, createdAt: list.createdAt.toISOString() };
}

export async function createWishlist(userId: string, name: string): Promise<WishlistSummary> {
  const count = await prisma.wishlist.count({ where: { userId } });
  if (count >= WISHLIST_LIMIT) {
    throw new AppError(409, "CONFLICT", `You can have at most ${WISHLIST_LIMIT} lists`);
  }
  try {
    const created = await prisma.wishlist.create({ data: { userId, name }, select: { id: true } });
    return await summaryOf(userId, created.id);
  } catch (err) {
    if (isUniqueViolationOn(err, "name")) throw duplicateName();
    throw err;
  }
}

export async function renameWishlist(userId: string, wishlistId: string, name: string): Promise<WishlistSummary> {
  try {
    const { count } = await prisma.wishlist.updateMany({ where: { id: wishlistId, userId }, data: { name } });
    if (count === 0) throw notFound();
  } catch (err) {
    if (isUniqueViolationOn(err, "name")) throw duplicateName();
    throw err;
  }
  return summaryOf(userId, wishlistId);
}

export async function deleteWishlist(userId: string, wishlistId: string): Promise<void> {
  const { count } = await prisma.wishlist.deleteMany({ where: { id: wishlistId, userId } });
  if (count === 0) throw notFound();
}

/** Idempotent: saving a hotel that's already in the list is a no-op. */
export async function addHotel(userId: string, wishlistId: string, hotelId: string): Promise<void> {
  const list = await prisma.wishlist.findFirst({
    where: { id: wishlistId, userId },
    select: { _count: { select: { items: true } } },
  });
  if (!list) throw notFound();
  const hotel = await prisma.hotel.count({ where: { id: hotelId, isActive: true } });
  if (hotel === 0) throw new AppError(404, "NOT_FOUND", "Hotel not found");
  const existing = await prisma.wishlistItem.count({ where: { wishlistId, hotelId } });
  if (existing > 0) return;
  if (list._count.items >= WISHLIST_ITEM_LIMIT) {
    throw new AppError(409, "CONFLICT", `A list can hold at most ${WISHLIST_ITEM_LIMIT} hotels`);
  }
  try {
    await prisma.wishlistItem.create({ data: { wishlistId, hotelId }, select: { id: true } });
  } catch (err) {
    // A concurrent save of the same hotel
    if (!isUniqueViolationOn(err, "hotelId") && !isUniqueViolationOn(err, "hotel_id")) throw err;
  }
}

/** Idempotent too: removing a hotel that isn't in the list is fine (the list itself must be yours). */
export async function removeHotel(userId: string, wishlistId: string, hotelId: string): Promise<void> {
  const list = await prisma.wishlist.count({ where: { id: wishlistId, userId } });
  if (list === 0) throw notFound();
  await prisma.wishlistItem.deleteMany({ where: { wishlistId, hotelId } });
}
