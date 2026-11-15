import {
  BOOKING_TZ,
  nightsBetween,
  todayIn,
  type AdminBooking,
  type AdminBookingListQuery,
  type AdminBookingRoomOption,
  type AdminBookingSummary,
  type Paginated,
  type PublicUser,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { fromDbDate, toDbDate } from "../lib/dates";
import { getPaymentProvider, type PaymentProvider } from "../lib/payments";
import { prisma } from "../lib/prisma";
import { isExclusionViolation, isWriteConflict } from "../lib/prisma-errors";
import { bookingSnapshot, recordAudit } from "./audit.service";
import { blockingBookingWhere } from "./availability.service";
import { canAccessHotel } from "./hotel-access.service";
import { releaseBookingPayment } from "./payment.service";

const adminBookingSelect = {
  id: true,
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
  cancelReason: true,
  checkedInAt: true,
  checkedOutAt: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  /** Latest payment attempt only. */
  payments: {
    select: { status: true, amount: true, provider: true, paidAt: true, refundedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
  },
  room: {
    select: {
      id: true,
      number: true,
      roomType: {
        select: {
          id: true,
          name: true,
          hotel: { select: { id: true, name: true, checkInTime: true, checkOutTime: true } },
        },
      },
    },
  },
} satisfies Prisma.BookingSelect;

type AdminBookingRow = Prisma.BookingGetPayload<{ select: typeof adminBookingSelect }>;

// ---------- Rules ----------
// Each rule exists twice: as a `where` (the conditional write — races can't break it) and as a flag on the
// mapped row (what the UI may offer). Keep the pairs in step.

/** A PENDING hold that still holds its room (null `expiresAt` blocks too, as in `blockingBookingWhere`). */
const activeHoldWhere = (now: Date): Prisma.BookingWhereInput => ({
  status: "PENDING",
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

const checkInWhere = (today: string): Prisma.BookingWhereInput => ({
  status: "CONFIRMED",
  checkedInAt: null,
  checkIn: { lte: toDbDate(today) },
  checkOut: { gt: toDbDate(today) },
});

const checkOutWhere: Prisma.BookingWhereInput = { status: "CONFIRMED", checkedInAt: { not: null } };

const cancelWhere = (now: Date): Prisma.BookingWhereInput => ({
  OR: [{ status: "CONFIRMED", checkedInAt: null }, activeHoldWhere(now)],
});

const moveWhere = (now: Date, today: string): Prisma.BookingWhereInput => ({
  checkOut: { gt: toDbDate(today) },
  OR: [{ status: "CONFIRMED" }, activeHoldWhere(now)],
});

/** STAFF see only bookings of hotels they are assigned to; ADMIN see all. */
function visibleWhere(user: PublicUser): Prisma.BookingWhereInput {
  return user.role === "ADMIN" ? {} : { room: { roomType: { hotel: { staff: { some: { userId: user.id } } } } } };
}

/** Lapsed holds still read PENDING in the DB (and still count for `bookings_no_overlap`) — flip them first. */
function expireLapsedHolds(where: Prisma.BookingWhereInput, now: Date) {
  return prisma.booking.updateMany({
    where: { ...where, status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}

function toSummary(row: AdminBookingRow): AdminBookingSummary {
  const checkIn = fromDbDate(row.checkIn);
  const checkOut = fromDbDate(row.checkOut);
  const { roomType } = row.room;
  return {
    code: row.code,
    status: row.status,
    checkedIn: row.status === "CONFIRMED" && row.checkedInAt !== null,
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    guests: row.guests,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    totalAmount: row.totalAmount.toNumber(),
    currency: row.currency,
    paymentStatus: row.payments[0]?.status ?? null,
    hotel: { id: roomType.hotel.id, name: roomType.hotel.name },
    roomType: { id: roomType.id, name: roomType.name },
    room: { id: row.room.id, number: row.room.number },
    createdAt: row.createdAt.toISOString(),
  };
}

/** Rows are read after `expireLapsedHolds`, so `status` is already the effective one. */
export function toAdminBooking(row: AdminBookingRow, now: Date): AdminBooking {
  const summary = toSummary(row);
  const today = todayIn(BOOKING_TZ, now);
  const confirmed = row.status === "CONFIRMED";
  const activeHold = row.status === "PENDING" && (row.expiresAt === null || row.expiresAt > now);
  const payment = row.payments[0];
  return {
    ...summary,
    guestPhone: row.guestPhone,
    customer: row.user,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
    checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
    payment: payment
      ? {
          status: payment.status,
          amount: payment.amount.toNumber(),
          provider: payment.provider,
          paidAt: payment.paidAt?.toISOString() ?? null,
          refundedAt: payment.refundedAt?.toISOString() ?? null,
        }
      : null,
    hotel: row.room.roomType.hotel,
    canCheckIn: confirmed && !summary.checkedIn && summary.checkIn <= today && today < summary.checkOut,
    canCheckOut: summary.checkedIn,
    canCancel: (confirmed && !summary.checkedIn) || activeHold,
    canMoveRoom: (confirmed || activeHold) && today < summary.checkOut,
  };
}

// ---------- Reads ----------

function statusWhere(status: AdminBookingListQuery["status"]): Prisma.BookingWhereInput {
  switch (status) {
    case "all":
      return {};
    case "CONFIRMED":
      return { status: "CONFIRMED", checkedInAt: null };
    case "CHECKED_IN":
      return { status: "CONFIRMED", checkedInAt: { not: null } };
    default:
      return { status };
  }
}

export async function listAdminBookings(
  user: PublicUser,
  query: AdminBookingListQuery,
  now: Date = new Date(),
): Promise<Paginated<AdminBookingSummary>> {
  const { hotelId, status, from, to, q, page, pageSize } = query;
  if (hotelId !== undefined && !(await canAccessHotel(user, hotelId))) {
    throw new AppError(403, "FORBIDDEN", "No access to this hotel");
  }
  const visible = visibleWhere(user);
  await expireLapsedHolds(visible, now);

  const where: Prisma.BookingWhereInput = {
    AND: [
      visible,
      statusWhere(status),
      hotelId !== undefined ? { room: { roomType: { hotelId } } } : {},
      to !== undefined ? { checkIn: { lte: toDbDate(to) } } : {},
      from !== undefined ? { checkOut: { gt: toDbDate(from) } } : {},
      q !== undefined
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { guestName: { contains: q, mode: "insensitive" } },
              { guestEmail: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, rows] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: [{ checkIn: "desc" }, { code: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: adminBookingSelect,
    }),
  ]);
  return {
    items: rows.map(toSummary),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** The booking if `user` may see it, else 404 (staff can't tell another hotel's booking exists). */
async function findVisibleRow(user: PublicUser, code: string): Promise<AdminBookingRow> {
  const row = await prisma.booking.findFirst({
    where: { AND: [{ code }, visibleWhere(user)] },
    select: adminBookingSelect,
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Booking not found");
  return row;
}

async function loadVisible(user: PublicUser, code: string, now: Date): Promise<AdminBookingRow> {
  await expireLapsedHolds({ code }, now);
  return findVisibleRow(user, code);
}

export async function getAdminBooking(user: PublicUser, code: string, now: Date = new Date()): Promise<AdminBooking> {
  return toAdminBooking(await loadVisible(user, code, now), now);
}

/** Every room of the booking's room type, with whether the booking could move there. */
export async function listBookingRoomOptions(
  user: PublicUser,
  code: string,
  now: Date = new Date(),
): Promise<AdminBookingRoomOption[]> {
  const row = await loadVisible(user, code, now);
  const blocking = blockingBookingWhere(fromDbDate(row.checkIn), fromDbDate(row.checkOut), now);
  const rooms = await prisma.room.findMany({
    where: { roomTypeId: row.room.roomType.id },
    orderBy: [{ number: "asc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      isActive: true,
      _count: { select: { bookings: { where: { ...blocking, id: { not: row.id } } } } },
    },
  });
  return rooms.map((room) => {
    const current = room.id === row.room.id;
    return {
      id: room.id,
      number: room.number,
      isActive: room.isActive,
      current,
      available: room.isActive && !current && room._count.bookings === 0,
    };
  });
}

// ---------- Actions ----------

/** Reads the booking as it is now and records the change from `before`. Bookings are keyed by their code, as in the admin URLs. */
async function auditBooking(user: PublicUser, code: string, now: Date, before: AdminBooking): Promise<AdminBooking> {
  const after = await getAdminBooking(user, code, now);
  await recordAudit({
    actor: user,
    entityType: "BOOKING",
    entityId: after.code,
    entityLabel: after.code,
    hotelId: after.hotel.id,
    before: bookingSnapshot(before),
    after: bookingSnapshot(after),
  });
  return after;
}

/**
 * One conditional write per action: `rule` + visibility go in the `where`. Nothing changed → 404 when the
 * booking isn't visible, else 409 with `refusal`.
 */
async function applyAction(
  user: PublicUser,
  code: string,
  now: Date,
  rule: Prisma.BookingWhereInput,
  data: Prisma.BookingUpdateManyMutationInput,
  refusal: string,
): Promise<void> {
  await expireLapsedHolds({ code }, now);
  const { count } = await prisma.booking.updateMany({ where: { AND: [{ code }, visibleWhere(user), rule] }, data });
  if (count === 0) {
    await findVisibleRow(user, code);
    throw new AppError(409, "CONFLICT", refusal);
  }
}

export async function checkInBooking(user: PublicUser, code: string, now: Date = new Date()): Promise<AdminBooking> {
  const today = todayIn(BOOKING_TZ, now);
  const before = await getAdminBooking(user, code, now);
  await applyAction(user, code, now, checkInWhere(today), { checkedInAt: now }, "This booking can't be checked in");
  return auditBooking(user, code, now, before);
}

export async function checkOutBooking(user: PublicUser, code: string, now: Date = new Date()): Promise<AdminBooking> {
  const before = await getAdminBooking(user, code, now);
  await applyAction(
    user,
    code,
    now,
    checkOutWhere,
    { status: "COMPLETED", checkedOutAt: now },
    "This booking can't be checked out",
  );
  return auditBooking(user, code, now, before);
}

/** Cancels with a staff reason, then refunds a paid booking in full (or drops the open payment intent). */
export async function cancelAdminBooking(
  user: PublicUser,
  code: string,
  reason: string,
  now: Date = new Date(),
  opts: { provider?: PaymentProvider } = {},
): Promise<AdminBooking> {
  const before = await getAdminBooking(user, code, now);
  await applyAction(
    user,
    code,
    now,
    cancelWhere(now),
    { status: "CANCELLED", cancelledAt: now, cancelReason: reason },
    "This booking can't be cancelled",
  );
  await releaseBookingPayment(code, now, opts.provider ?? getPaymentProvider());
  return auditBooking(user, code, now, before);
}

const roomUnavailable = () => new AppError(409, "ROOM_UNAVAILABLE", "This room isn't available for this stay");

/**
 * Moves the stay to another room of the same room type. The free check gives a clear 409; the
 * `bookings_no_overlap` constraint settles a concurrent booking of the target room.
 */
export async function moveBookingRoom(
  user: PublicUser,
  code: string,
  roomId: string,
  now: Date = new Date(),
): Promise<AdminBooking> {
  const today = todayIn(BOOKING_TZ, now);
  const row = await loadVisible(user, code, now);
  const target = await prisma.room.findFirst({
    where: { id: roomId, roomTypeId: row.room.roomType.id },
    select: { id: true, isActive: true },
  });
  if (!target) throw new AppError(404, "NOT_FOUND", "Room not found");
  if (!toAdminBooking(row, now).canMoveRoom) throw new AppError(409, "CONFLICT", "This booking can't be moved");
  if (target.id === row.room.id || !target.isActive) throw roomUnavailable();

  // Lapsed holds on the target still count for the constraint.
  await expireLapsedHolds({ roomId: target.id }, now);
  const checkIn = fromDbDate(row.checkIn);
  const checkOut = fromDbDate(row.checkOut);
  const clashes = await prisma.booking.count({
    where: { ...blockingBookingWhere(checkIn, checkOut, now), roomId: target.id, id: { not: row.id } },
  });
  if (clashes > 0) throw roomUnavailable();

  try {
    const { count } = await prisma.booking.updateMany({
      where: { AND: [{ id: row.id, roomId: row.room.id }, moveWhere(now, today)] },
      data: { roomId: target.id },
    });
    if (count === 0) throw new AppError(409, "CONFLICT", "This booking can't be moved");
  } catch (err) {
    if (isExclusionViolation(err) || isWriteConflict(err)) throw roomUnavailable();
    throw err;
  }
  return auditBooking(user, code, now, toAdminBooking(row, now));
}
