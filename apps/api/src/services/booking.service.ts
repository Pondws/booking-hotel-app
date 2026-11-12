import {
  BOOKING_TZ,
  HOLD_MINUTES,
  MAX_ACTIVE_HOLDS,
  nightsBetween,
  todayIn,
  type Booking,
  type CreateBookingData,
  type PublicUser,
} from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { generateBookingCode } from "../lib/booking-code";
import { fromDbDate, toDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { isExclusionViolation, isUniqueViolationOn } from "../lib/prisma-errors";
import { blockingBookingWhere } from "./availability.service";
import { quoteStay } from "./pricing.service";

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
  currency: true,
  expiresAt: true,
  cancelledAt: true,
  createdAt: true,
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
    totalAmount: row.totalAmount.toNumber(),
    currency: row.currency,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    cancellable: holdsRoom && todayIn(BOOKING_TZ, now) < checkIn,
    hotel: {
      name: roomType.hotel.name,
      slug: roomType.hotel.slug,
      city: roomType.hotel.city,
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
    select: { id: true, capacity: true },
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
    where: { status: "PENDING", expiresAt: { lt: now }, room: { roomTypeId } },
    data: { status: "EXPIRED" },
  });

  // 3. Soft cap on unpaid holds per user.
  const activeHolds = await prisma.booking.count({
    where: { userId: user.id, status: "PENDING", expiresAt: { gt: now } },
  });
  if (activeHolds >= MAX_ACTIVE_HOLDS) {
    throw new AppError(409, "CONFLICT", `You have ${MAX_ACTIVE_HOLDS} bookings waiting for payment`);
  }

  // 4. Price.
  const quote = await quoteStay(roomTypeId, checkIn, checkOut);

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
    totalAmount: new Prisma.Decimal(quote.total),
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
        // 7. Map.
        return toBooking(row, now);
      } catch (err) {
        if (isExclusionViolation(err)) break; // taken meanwhile → next room
        if (isUniqueViolationOn(err, "code") && attempt < MAX_CODE_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  // 6. Every candidate was taken.
  throw new AppError(409, "ROOM_UNAVAILABLE", "This room was just booked for these dates");
}
