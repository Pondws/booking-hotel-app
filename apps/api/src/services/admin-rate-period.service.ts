import { nightsBetween, type AdminRatePeriod, type PublicUser, type RatePeriodData } from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { fromDbDate, toDbDate } from "../lib/dates";
import { toPrice } from "../lib/money";
import { prisma } from "../lib/prisma";
import { isExclusionViolation, isWriteConflict } from "../lib/prisma-errors";
import { assertRoomTypeInHotel } from "./admin-room-type.service";
import { ratePeriodLabel, ratePeriodSnapshot, recordAudit } from "./audit.service";

const ratePeriodSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  price: true,
  createdAt: true,
  updatedAt: true,
  roomType: { select: { id: true, name: true } },
} satisfies Prisma.RatePeriodSelect;

type RatePeriodRow = Prisma.RatePeriodGetPayload<{ select: typeof ratePeriodSelect }>;

function auditRatePeriod(
  actor: PublicUser,
  hotelId: string,
  roomType: { id: string; name: string },
  before: AdminRatePeriod | null,
  after: AdminRatePeriod | null,
) {
  const current = after ?? before;
  if (!current) return;
  return recordAudit({
    actor,
    entityType: "RATE_PERIOD",
    entityId: current.id,
    entityLabel: ratePeriodLabel(roomType.name, current),
    hotelId,
    parentId: roomType.id,
    before: before && ratePeriodSnapshot(before),
    after: after && ratePeriodSnapshot(after),
  });
}

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
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  data: RatePeriodData,
): Promise<AdminRatePeriod> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  await assertNoOverlap(roomTypeId, data);
  const row = await withOverlapCheck(() =>
    prisma.ratePeriod.create({ data: { roomTypeId, ...columns(data) }, select: ratePeriodSelect }),
  );
  const created = toAdminRatePeriod(row);
  await auditRatePeriod(actor, hotelId, row.roomType, null, created);
  return created;
}

/** The period, only if it belongs to the room type of the hotel — otherwise 404. */
async function getRatePeriodInRoomType(hotelId: string, roomTypeId: string, ratePeriodId: string) {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  const found = await prisma.ratePeriod.findFirst({
    where: { id: ratePeriodId, roomTypeId },
    select: ratePeriodSelect,
  });
  if (!found) throw new AppError(404, "NOT_FOUND", "Rate period not found");
  return found;
}

export async function updateRatePeriod(
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  ratePeriodId: string,
  data: RatePeriodData,
): Promise<AdminRatePeriod> {
  const before = await getRatePeriodInRoomType(hotelId, roomTypeId, ratePeriodId);
  await assertNoOverlap(roomTypeId, data, ratePeriodId);
  const row = await withOverlapCheck(() =>
    prisma.ratePeriod.update({ where: { id: ratePeriodId }, data: columns(data), select: ratePeriodSelect }),
  );
  const updated = toAdminRatePeriod(row);
  await auditRatePeriod(actor, hotelId, row.roomType, toAdminRatePeriod(before), updated);
  return updated;
}

/** Bookings store their own totals, so nothing depends on a period. */
export async function deleteRatePeriod(
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  ratePeriodId: string,
): Promise<void> {
  const before = await getRatePeriodInRoomType(hotelId, roomTypeId, ratePeriodId);
  await prisma.ratePeriod.delete({ where: { id: ratePeriodId } });
  await auditRatePeriod(actor, hotelId, before.roomType, toAdminRatePeriod(before), null);
}
