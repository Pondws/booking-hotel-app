import type { Prisma } from "../generated/prisma/client";
import { toDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";

/**
 * A booking that holds its room for some night in `[checkIn, checkOut)`:
 * CONFIRMED, or PENDING that hasn't expired (`expiresAt` null or in the future).
 * Overlap is half-open, so back-to-back stays never block each other.
 */
export function blockingBookingWhere(
  checkIn: string,
  checkOut: string,
  now: Date = new Date(),
): Prisma.BookingWhereInput {
  return {
    checkIn: { lt: toDbDate(checkOut) },
    checkOut: { gt: toDbDate(checkIn) },
    OR: [
      { status: "CONFIRMED" },
      { status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  };
}

/** Active, unblocked rooms per room type for the range. Every requested id is present (0 when none). */
export async function availableRoomCounts(
  roomTypeIds: string[],
  checkIn: string,
  checkOut: string,
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const counts = new Map(roomTypeIds.map((id) => [id, 0]));
  if (roomTypeIds.length === 0) return counts;

  const groups = await prisma.room.groupBy({
    by: ["roomTypeId"],
    where: {
      roomTypeId: { in: roomTypeIds },
      isActive: true,
      bookings: { none: blockingBookingWhere(checkIn, checkOut, now) },
    },
    _count: { _all: true },
  });
  for (const g of groups) counts.set(g.roomTypeId, g._count._all);
  return counts;
}
