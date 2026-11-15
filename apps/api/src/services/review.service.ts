import type {
  Booking,
  CreateReviewData,
  HotelReviewList,
  HotelReviewsQuery,
  PublicUser,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { fromDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { getMyBooking } from "./booking.service";

const alreadyReviewed = () => new AppError(409, "CONFLICT", "This booking already has a review");

/**
 * Recomputes `Hotel.ratingAvg` / `reviewCount` from the visible reviews. The only code that writes those
 * columns; call it inside the same transaction as the review write. The hotel row is locked first so two
 * concurrent writes for one hotel can't interleave their aggregates. NO KEY UPDATE, not UPDATE: the review
 * insert already holds a FK KEY SHARE lock on the hotel, which FOR UPDATE conflicts with (→ deadlock).
 */
export async function recomputeHotelRating(tx: Prisma.TransactionClient, hotelId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM hotels WHERE id = ${hotelId} FOR NO KEY UPDATE`;
  const agg = await tx.review.aggregate({
    where: { hotelId, isHidden: false },
    _avg: { rating: true },
    _count: true,
  });
  await tx.hotel.update({
    where: { id: hotelId },
    data: { ratingAvg: agg._avg.rating ?? 0, reviewCount: agg._count },
  });
}

/** One review per own COMPLETED booking. User and hotel come from the booking, never the request body. */
export async function createMyReview(
  user: PublicUser,
  code: string,
  input: CreateReviewData,
  now: Date = new Date(),
): Promise<Booking> {
  const booking = await prisma.booking.findFirst({
    where: { code, userId: user.id },
    select: {
      id: true,
      status: true,
      review: { select: { id: true } },
      room: { select: { roomType: { select: { hotelId: true } } } },
    },
  });
  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.status !== "COMPLETED") throw new AppError(409, "CONFLICT", "Only completed stays can be reviewed");
  if (booking.review) throw alreadyReviewed();

  const hotelId = booking.room.roomType.hotelId;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          bookingId: booking.id,
          userId: user.id,
          hotelId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
      });
      await recomputeHotelRating(tx, hotelId);
    });
  } catch (err) {
    // A concurrent submit passed the pre-check too; the unique bookingId decides.
    if (isUniqueViolationOn(err, "bookingId") || isUniqueViolationOn(err, "booking_id")) throw alreadyReviewed();
    throw err;
  }
  return getMyBooking(user, code, now);
}

/** First word of the reviewer's name — the public page never shows the full name or email. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** Visible reviews of an active hotel, newest first. Unknown or inactive slug → 404. */
export async function listHotelReviews(slug: string, query: HotelReviewsQuery): Promise<HotelReviewList> {
  const { page, pageSize } = query;
  const hotel = await prisma.hotel.findFirst({ where: { slug, isActive: true }, select: { id: true } });
  if (!hotel) throw new AppError(404, "NOT_FOUND", "Hotel not found");

  const where = { hotelId: hotel.id, isHidden: false };
  const [total, reviews] = await prisma.$transaction([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
        booking: { select: { checkOut: true } },
      },
    }),
  ]);

  return {
    items: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      authorName: firstName(r.user.name),
      stayedAt: fromDbDate(r.booking.checkOut),
      createdAt: r.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
