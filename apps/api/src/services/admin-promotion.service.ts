import type { AdminPromotion, PromotionData, PublicUser } from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { fromDbDate, toDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { promotionSnapshot, recordAudit } from "./audit.service";

const promotionSelect = {
  id: true,
  name: true,
  type: true,
  percentOff: true,
  minNights: true,
  minDaysAhead: true,
  maxDaysAhead: true,
  code: true,
  validFrom: true,
  validUntil: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { bookings: true } },
} satisfies Prisma.PromotionSelect;

type PromotionRow = Prisma.PromotionGetPayload<{ select: typeof promotionSelect }>;

function toAdminPromotion(row: PromotionRow): AdminPromotion {
  const { _count, validFrom, validUntil, createdAt, updatedAt, ...rest } = row;
  return {
    ...rest,
    validFrom: validFrom ? fromDbDate(validFrom) : null,
    validUntil: validUntil ? fromDbDate(validUntil) : null,
    bookingCount: _count.bookings,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/** Shows in the hotel's history (parentId = hotelId), like reviews. */
function auditPromotion(
  actor: PublicUser,
  hotelId: string,
  before: AdminPromotion | null,
  after: AdminPromotion | null,
) {
  const current = after ?? before;
  if (!current) return;
  return recordAudit({
    actor,
    entityType: "PROMOTION",
    entityId: current.id,
    entityLabel: current.name,
    hotelId,
    parentId: hotelId,
    before: before && promotionSnapshot(before),
    after: after && promotionSnapshot(after),
  });
}

const columns = (data: PromotionData) => ({
  ...data,
  validFrom: data.validFrom === null ? null : toDbDate(data.validFrom),
  validUntil: data.validUntil === null ? null : toDbDate(data.validUntil),
});

/** Codes are unique across hotels. */
async function withCodeCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (isUniqueViolationOn(err, "code")) {
      throw new AppError(409, "CONFLICT", "This code is already in use", {
        formErrors: [],
        fieldErrors: { code: ["This code is already in use"] },
      });
    }
    throw err;
  }
}

async function assertHotelExists(hotelId: string) {
  const found = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
  if (!found) throw new AppError(404, "NOT_FOUND", "Hotel not found");
}

async function getPromotionInHotel(hotelId: string, promotionId: string): Promise<PromotionRow> {
  const found = await prisma.promotion.findFirst({ where: { id: promotionId, hotelId }, select: promotionSelect });
  if (!found) throw new AppError(404, "NOT_FOUND", "Promotion not found");
  return found;
}

/** Newest first. */
export async function listPromotions(hotelId: string): Promise<AdminPromotion[]> {
  await assertHotelExists(hotelId);
  const rows = await prisma.promotion.findMany({
    where: { hotelId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: promotionSelect,
  });
  return rows.map(toAdminPromotion);
}

export async function createPromotion(
  actor: PublicUser,
  hotelId: string,
  data: PromotionData,
): Promise<AdminPromotion> {
  await assertHotelExists(hotelId);
  const row = await withCodeCheck(() =>
    prisma.promotion.create({ data: { hotelId, ...columns(data) }, select: promotionSelect }),
  );
  const created = toAdminPromotion(row);
  await auditPromotion(actor, hotelId, null, created);
  return created;
}

/** Bookings keep the discount they were held with, so editing a deal never reprices them. */
export async function updatePromotion(
  actor: PublicUser,
  hotelId: string,
  promotionId: string,
  data: PromotionData,
): Promise<AdminPromotion> {
  const before = await getPromotionInHotel(hotelId, promotionId);
  const row = await withCodeCheck(() =>
    prisma.promotion.update({ where: { id: promotionId }, data: columns(data), select: promotionSelect }),
  );
  const updated = toAdminPromotion(row);
  await auditPromotion(actor, hotelId, toAdminPromotion(before), updated);
  return updated;
}

/** Bookings keep their amount and `discountLabel`; their `promotionId` is set to null by the FK. */
export async function deletePromotion(actor: PublicUser, hotelId: string, promotionId: string): Promise<void> {
  const before = await getPromotionInHotel(hotelId, promotionId);
  await prisma.promotion.delete({ where: { id: promotionId } });
  await auditPromotion(actor, hotelId, toAdminPromotion(before), null);
}
