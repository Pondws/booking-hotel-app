import { nightsBetween, type AdminRatePeriod, type RatePeriodData } from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { fromDbDate, toDbDate } from "../lib/dates";
import { toPrice } from "../lib/money";
import { prisma } from "../lib/prisma";
import { isExclusionViolation, isWriteConflict } from "../lib/prisma-errors";
import { assertRoomTypeInHotel } from "./admin-room-type.service";

const ratePeriodSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  price: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RatePeriodSelect;

type RatePeriodRow = Prisma.RatePeriodGetPayload<{ select: typeof ratePeriodSelect }>;

function toAdminRatePeriod(row: RatePeriodRow): AdminRatePeriod {
  const startDate = fromDbDate(row.startDate);
  const endDate = fromDbDate(row.endDate);
  return {
    id: row.id,
    name: row.name,
    startDate,
    endDate,
    nights: nightsBetween(startDate, endDate),
    price: row.price.toNumber(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const overlapError = (other?: { name: string | null; startDate: Date; endDate: Date }) =>
  new AppError(
    409,
    "CONFLICT",
    other
      ? `These dates overlap ${other.name ? `"${other.name}"` : "another rate period"} ` +
        `(${fromDbDate(other.startDate)} to ${fromDbDate(other.endDate)})`
      : "These dates overlap another rate period",
  );

/** Readable 409 before writing; the DB constraint `rate_periods_no_overlap` is the backstop. */
async function assertNoOverlap(roomTypeId: string, data: RatePeriodData, exceptId?: string) {
  const other = await prisma.ratePeriod.findFirst({
    where: {
      roomTypeId,
      startDate: { lt: toDbDate(data.endDate) },
      endDate: { gt: toDbDate(data.startDate) },
      ...(exceptId !== undefined && { NOT: { id: exceptId } }),
    },
    orderBy: { startDate: "asc" },
    select: { name: true, startDate: true, endDate: true },
  });
  if (other) throw overlapError(other);
}

/** A concurrent overlapping write fails on the exclusion constraint (23P01) or deadlocks (P2034). */
async function withOverlapCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (isExclusionViolation(err, "rate_periods_no_overlap") || isWriteConflict(err)) throw overlapError();
    throw err;
  }
}

const columns = (data: RatePeriodData) => ({
  name: data.name,
  startDate: toDbDate(data.startDate),
  endDate: toDbDate(data.endDate),
  price: toPrice(data.price),
});

export async function listRatePeriods(hotelId: string, roomTypeId: string): Promise<AdminRatePeriod[]> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  const rows = await prisma.ratePeriod.findMany({
    where: { roomTypeId },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    select: ratePeriodSelect,
  });
  return rows.map(toAdminRatePeriod);
}

export async function createRatePeriod(
  hotelId: string,
  roomTypeId: string,
  data: RatePeriodData,
): Promise<AdminRatePeriod> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  await assertNoOverlap(roomTypeId, data);
  const row = await withOverlapCheck(() =>
    prisma.ratePeriod.create({ data: { roomTypeId, ...columns(data) }, select: ratePeriodSelect }),
  );
  return toAdminRatePeriod(row);
}

/** The period, only if it belongs to the room type of the hotel — otherwise 404. */
async function assertRatePeriodInRoomType(hotelId: string, roomTypeId: string, ratePeriodId: string) {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  const found = await prisma.ratePeriod.findFirst({
    where: { id: ratePeriodId, roomTypeId },
    select: { id: true },
  });
  if (!found) throw new AppError(404, "NOT_FOUND", "Rate period not found");
}

export async function updateRatePeriod(
  hotelId: string,
  roomTypeId: string,
  ratePeriodId: string,
  data: RatePeriodData,
): Promise<AdminRatePeriod> {
  await assertRatePeriodInRoomType(hotelId, roomTypeId, ratePeriodId);
  await assertNoOverlap(roomTypeId, data, ratePeriodId);
  const row = await withOverlapCheck(() =>
    prisma.ratePeriod.update({ where: { id: ratePeriodId }, data: columns(data), select: ratePeriodSelect }),
  );
  return toAdminRatePeriod(row);
}

/** Bookings store their own totals, so nothing depends on a period. */
export async function deleteRatePeriod(
  hotelId: string,
  roomTypeId: string,
  ratePeriodId: string,
): Promise<void> {
  await assertRatePeriodInRoomType(hotelId, roomTypeId, ratePeriodId);
  await prisma.ratePeriod.delete({ where: { id: ratePeriodId } });
}
