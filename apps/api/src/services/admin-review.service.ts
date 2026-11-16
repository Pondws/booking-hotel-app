import type {
  AdminReview,
  AdminReviewListQuery,
  Paginated,
  PublicUser,
  UpdateReviewVisibilityInput,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { fromDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { recordAudit, reviewSnapshot } from "./audit.service";
import { canAccessHotel } from "./hotel-access.service";
import { recomputeHotelRating } from "./review.service";

const adminReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  isHidden: true,
  hiddenAt: true,
  createdAt: true,
  user: { select: { name: true } },
  booking: { select: { code: true, checkOut: true } },
  hotel: { select: { id: true, name: true } },
} satisfies Prisma.ReviewSelect;

type AdminReviewRow = Prisma.ReviewGetPayload<{ select: typeof adminReviewSelect }>;

function toAdminReview(row: AdminReviewRow): AdminReview {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    guestName: row.user.name,
    bookingCode: row.booking.code,
    hotel: row.hotel,
    stayedAt: fromDbDate(row.booking.checkOut),
    isHidden: row.isHidden,
    hiddenAt: row.hiddenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** STAFF see only reviews of hotels they are assigned to; ADMIN see all. */
function visibleWhere(user: PublicUser): Prisma.ReviewWhereInput {
  return user.role === "ADMIN" ? {} : { hotel: { staff: { some: { userId: user.id } } } };
}

const visibilityWhere = (v: AdminReviewListQuery["visibility"]): Prisma.ReviewWhereInput =>
  v === "all" ? {} : { isHidden: v === "hidden" };

export async function listAdminReviews(
  user: PublicUser,
  query: AdminReviewListQuery,
): Promise<Paginated<AdminReview>> {
  const { hotelId, visibility, page, pageSize } = query;
  if (hotelId !== undefined && !(await canAccessHotel(user, hotelId))) {
    throw new AppError(403, "FORBIDDEN", "No access to this hotel");
  }
  const where: Prisma.ReviewWhereInput = {
    AND: [visibleWhere(user), visibilityWhere(visibility), hotelId !== undefined ? { hotelId } : {}],
  };
  const [total, rows] = await prisma.$transaction([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: adminReviewSelect,
    }),
  ]);
  return {
    items: rows.map(toAdminReview),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** The review if `user` may see it, else 404 (staff can't tell another hotel's review exists). */
async function findVisible(user: PublicUser, reviewId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const row = await db.review.findFirst({
    where: { AND: [{ id: reviewId }, visibleWhere(user)] },
    select: adminReviewSelect,
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Review not found");
  return row;
}

/**
 * Hides or shows a review and recomputes the hotel rating in the same transaction. The update is conditional
 * on the current value, so of two concurrent identical requests only one writes (and is audited); the other —
 * like any request that asks for the value already set — returns the review unchanged.
 */
export async function setReviewVisibility(
  user: PublicUser,
  reviewId: string,
  { isHidden }: UpdateReviewVisibilityInput,
  now: Date = new Date(),
): Promise<AdminReview> {
  const before = await findVisible(user, reviewId);
  const { changed, after } = await prisma.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({
      where: { id: reviewId, isHidden: !isHidden },
      data: { isHidden, hiddenAt: isHidden ? now : null },
    });
    if (count > 0) await recomputeHotelRating(tx, before.hotel.id);
    return { changed: count > 0, after: await findVisible(user, reviewId, tx) };
  });
  const review = toAdminReview(after);
  if (changed) {
    await recordAudit({
      actor: user,
      entityType: "REVIEW",
      entityId: review.id,
      entityLabel: review.bookingCode,
      hotelId: review.hotel.id,
      // The hotel's history shows its reviews' moderation too.
      parentId: review.hotel.id,
      before: reviewSnapshot(toAdminReview(before)),
      after: reviewSnapshot(review),
    });
  }
  return review;
}
