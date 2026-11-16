import {
  BOOKING_TZ,
  HOLD_MINUTES,
  MAX_ACTIVE_HOLDS,
  POINTS_MAX_SHARE,
  POINTS_MIN_REDEEM,
  nightsBetween,
  todayIn,
  type Booking,
  type BookingListQuery,
  type CreateBookingData,
  type Paginated,
  type PublicUser,
} from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { generateBookingCode } from "../lib/booking-code";
import { fromDbDate, toDbDate } from "../lib/dates";
import { getPaymentProvider, type PaymentProvider } from "../lib/payments";
import { prisma } from "../lib/prisma";
import { isExclusionViolation, isUniqueViolationOn, isWriteConflict } from "../lib/prisma-errors";
import { blockingBookingWhere } from "./availability.service";
import { releaseBookingPayment } from "./payment.service";
import { isPromoCodeValid, quoteStay } from "./pricing.service";
import { pointsBalance } from "./rewards.service";

/** Inserts per room before giving up on code collisions (each is a 1-in-~10⁹ event). */
const MAX_CODE_ATTEMPTS = 5;

const imageSelect = { url: true, alt: true } as const;
const imageOrder = [{ sortOrder: "asc" }, { id: "asc" }] as const;

/** Everything `toBooking` needs. The room itself (and its number) is never selected. */
export const bookingSelect = {
  code: true,
  status: true,
  checkIn: true,
  checkOut: true,
  guests: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  totalAmount: true,
  discountAmount: true,
  discountLabel: true,
  pointsRedeemed: true,
  pointsEarned: true,
  currency: true,
  expiresAt: true,
  cancelledAt: true,
  createdAt: true,
  /** Latest payment attempt only. */
  payments: {
    select: { status: true, paidAt: true, refundedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
  },
  review: { select: { rating: true, comment: true, createdAt: true } },
  room: {
    select: {
      roomType: {
        select: {
          id: true,
          name: true,
          hotel: {
            select: {
              name: true,
              slug: true,
              city: true,
              checkInTime: true,
              checkOutTime: true,
              images: { select: imageSelect, orderBy: [...imageOrder], take: 1 },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BookingSelect;

export type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

/** The single DB → API mapper: effective status, nights, ISO datetimes, `cancellable`. */
export function toBooking(row: BookingRow, now: Date): Booking {
  const checkIn = fromDbDate(row.checkIn);
  const checkOut = fromDbDate(row.checkOut);
  const lapsed = row.status === "PENDING" && row.expiresAt !== null && row.expiresAt <= now;
  const status = lapsed ? "EXPIRED" : row.status;
  const holdsRoom =
    status === "CONFIRMED" || (status === "PENDING" && (row.expiresAt === null || row.expiresAt > now));
  const { roomType } = row.room;
  const payment = row.payments[0];

  return {
    code: row.code,
    status,
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    guests: row.guests,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    subtotalAmount: row.totalAmount.plus(row.discountAmount).plus(row.pointsRedeemed).toNumber(),
    discountAmount: row.discountAmount.toNumber(),
    discountLabel: row.discountLabel,
    pointsRedeemed: row.pointsRedeemed,
    pointsEarned: row.pointsEarned,
    totalAmount: row.totalAmount.toNumber(),
    currency: row.currency,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    cancellable: holdsRoom && todayIn(BOOKING_TZ, now) < checkIn,
    payable: status === "PENDING" && row.expiresAt !== null && row.expiresAt > now,
    payment: payment
      ? {
          status: payment.status,
          paidAt: payment.paidAt?.toISOString() ?? null,
          refundedAt: payment.refundedAt?.toISOString() ?? null,
        }
      : null,
    reviewable: status === "COMPLETED" && row.review === null,
    review: row.review
      ? { rating: row.review.rating, comment: row.review.comment, createdAt: row.review.createdAt.toISOString() }
      : null,
    hotel: {
      name: roomType.hotel.name,
      slug: roomType.hotel.slug,
      city: roomType.hotel.city,
      checkInTime: roomType.hotel.checkInTime,
      checkOutTime: roomType.hotel.checkOutTime,
      coverImage: roomType.hotel.images[0] ?? null,
    },
    roomType: { id: roomType.id, name: roomType.name },
  };
}

/**
 * Holds a room of `input.roomTypeId` for `HOLD_MINUTES` as a PENDING booking.
 * No wrapping transaction: Postgres aborts a transaction on its first error, and "catch the
 * overlap violation, try the next room" needs each insert to stand alone. The
 * `bookings_no_overlap` constraint decides every race.
 */
export async function createBooking(
  user: PublicUser,
  input: CreateBookingData,
  now: Date = new Date(),
  opts: { generateCode?: () => string } = {},
): Promise<Booking> {
  const generateCode = opts.generateCode ?? (() => generateBookingCode());
  const { roomTypeId, checkIn, checkOut, guests } = input;

  // 1. Room type must be bookable and big enough.
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, isActive: true, hotel: { isActive: true } },
    select: { id: true, capacity: true, hotelId: true },
  });
  if (!roomType) throw new AppError(404, "NOT_FOUND", "Room type not found");
  if (guests > roomType.capacity) {
    throw new AppError(400, "VALIDATION_FAILED", "Validation failed", {
      formErrors: [],
      fieldErrors: { guests: [`This room sleeps ${roomType.capacity} guests`] },
    });
  }

  // 2. Lapsed holds still count for the overlap constraint — release them first.
  await prisma.booking.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now }, room: { roomTypeId } },
    data: { status: "EXPIRED" },
  });

  // 3. Soft cap on unpaid holds per user.
  const activeHolds = await prisma.booking.count({
    where: { userId: user.id, status: "PENDING", expiresAt: { gt: now } },
  });
  if (activeHolds >= MAX_ACTIVE_HOLDS) {
    throw new AppError(409, "CONFLICT", `You have ${MAX_ACTIVE_HOLDS} bookings waiting for payment`);
  }

  // 4. Price, with the best deal. A code that can't be used for this stay is a field error, never ignored.
  const { promoCode } = input;
  if (promoCode !== undefined && !(await isPromoCodeValid(roomType.hotelId, promoCode, checkIn, checkOut, now))) {
    throw new AppError(400, "VALIDATION_FAILED", "Validation failed", {
      formErrors: [],
      fieldErrors: { promoCode: ["This code can't be used for this stay"] },
    });
  }
  const quote = await quoteStay(roomTypeId, checkIn, checkOut, { promoCode, now });

  // 4b. Reward points come off the price after deals (1 point = 1 unit of currency).
  const points = input.pointsToRedeem ?? 0;
  if (points > 0) await assertRedeemable(user.id, points, quote.total, now);

  // 5. Try each free room in order; the DB constraint settles races.
  const candidates = await prisma.room.findMany({
    where: { roomTypeId, isActive: true, bookings: { none: blockingBookingWhere(checkIn, checkOut, now) } },
    select: { id: true },
    orderBy: [{ number: "asc" }, { id: "asc" }],
  });
  const data = {
    userId: user.id,
    guestName: input.guestName ?? user.name,
    guestEmail: input.guestEmail ?? user.email,
    guestPhone: input.guestPhone ?? null,
    guests,
    checkIn: toDbDate(checkIn),
    checkOut: toDbDate(checkOut),
    status: "PENDING",
    totalAmount: new Prisma.Decimal(quote.total).minus(points),
    pointsRedeemed: points,
    discountAmount: new Prisma.Decimal(quote.discount?.amount ?? 0),
    discountLabel: quote.discount?.name ?? null,
    promotionId: quote.discount?.promotionId ?? null,
    currency: quote.currency,
    expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
  } satisfies Omit<Prisma.BookingUncheckedCreateInput, "code" | "roomId">;

  for (const room of candidates) {
    for (let attempt = 1; ; attempt++) {
      try {
        const row = await prisma.booking.create({
          data: { ...data, roomId: room.id, code: generateCode() },
          select: bookingSelect,
        });
        // A concurrent hold may have spent the same points: re-check now that this one counts.
        if (points > 0 && (await pointsBalance(user.id, now)) < 0) {
          await prisma.booking.delete({ where: { code: row.code } });
          throw new AppError(409, "CONFLICT", "Your points were just used on another booking");
        }
        // 7. Map.
        return toBooking(row, now);
      } catch (err) {
        if (isExclusionViolation(err)) break; // taken meanwhile → next room
        if (isUniqueViolationOn(err, "code") && attempt < MAX_CODE_ATTEMPTS) continue;
        // Racing a concurrent insert on this room can deadlock instead of raising the exclusion
        // violation; the retry then sees the winner's row and moves on.
        if (isWriteConflict(err) && attempt < MAX_CODE_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  // 6. Every candidate was taken.
  throw new AppError(409, "ROOM_UNAVAILABLE", "This room was just booked for these dates");
}

const pointsError = (message: string) =>
  new AppError(400, "VALIDATION_FAILED", "Validation failed", {
    formErrors: [],
    fieldErrors: { pointsToRedeem: [message] },
  });

/** At least the minimum, at most the share of the price, and no more than the balance. */
async function assertRedeemable(userId: string, points: number, total: number, now: Date) {
  if (points < POINTS_MIN_REDEEM) throw pointsError(`Use at least ${POINTS_MIN_REDEEM} points`);
  const cap = Math.floor(total * POINTS_MAX_SHARE);
  if (points > cap) throw pointsError(`Use at most ${cap} points for this stay`);
  if (points > (await pointsBalance(userId, now))) throw pointsError("You don't have enough points");
}

/** Flips this user's lapsed holds to EXPIRED so reads and cancels agree with the mapper. */
export function expireLapsedHolds(userId: string, now: Date) {
  return prisma.booking.updateMany({
    where: { userId, status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}

export async function listMyBookings(
  user: PublicUser,
  query: BookingListQuery,
  now: Date = new Date(),
): Promise<Paginated<Booking>> {
  const { page, pageSize } = query;
  await expireLapsedHolds(user.id, now);
  const where = { userId: user.id } satisfies Prisma.BookingWhereInput;
  const [total, rows] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: bookingSelect,
    }),
  ]);
  return {
    items: rows.map((row) => toBooking(row, now)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function findMyBooking(userId: string, code: string, now: Date): Promise<Booking> {
  const row = await prisma.booking.findFirst({ where: { code, userId }, select: bookingSelect });
  if (!row) throw new AppError(404, "NOT_FOUND", "Booking not found");
  return toBooking(row, now);
}

export async function getMyBooking(user: PublicUser, code: string, now: Date = new Date()): Promise<Booking> {
  await expireLapsedHolds(user.id, now);
  return findMyBooking(user.id, code, now);
}

/**
 * Cancels in a single conditional `updateMany`: the row is touched only if it still holds the
 * room and check-in is after today in `BOOKING_TZ`, so a hold that lapses between check and
 * write can never be cancelled.
 */
export async function cancelMyBooking(
  user: PublicUser,
  code: string,
  now: Date = new Date(),
  opts: { provider?: PaymentProvider } = {},
): Promise<Booking> {
  const today = toDbDate(todayIn(BOOKING_TZ, now));
  const { count } = await prisma.booking.updateMany({
    where: {
      code,
      userId: user.id,
      checkIn: { gt: today },
      OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: now } }],
    },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  if (count === 0) {
    await expireLapsedHolds(user.id, now);
    await findMyBooking(user.id, code, now); // 404 when it isn't theirs
    throw new AppError(409, "CONFLICT", "This booking can't be cancelled");
  }
  await releaseBookingPayment(code, now, opts.provider ?? getPaymentProvider());
  return findMyBooking(user.id, code, now);
}
