import {
  auditChangeSchema,
  type AdminAmenity,
  type AdminAuditLog,
  type AdminAuditLogListQuery,
  type AdminBooking,
  type AdminHotel,
  type AdminRatePeriod,
  type AdminReview,
  type AdminRoomType,
  type AdminStaff,
  type AuditChange,
  type AuditEntityType,
  type AuditValue,
  type Paginated,
  type PublicUser,
} from "@booking/shared";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import { canAccessHotel } from "./hotel-access.service";

/** The fields of an entity that the history shows, flattened to JSON values. */
export type AuditSnapshot = Record<string, AuditValue>;

// ---------- Snapshots ----------
// One per entity type. Keep them to what staff edit — ids and timestamps add noise to every diff.

export const hotelSnapshot = (h: AdminHotel): AuditSnapshot => ({
  name: h.name,
  city: h.city,
  address: h.address,
  description: h.description,
  checkInTime: h.checkInTime,
  checkOutTime: h.checkOutTime,
  isActive: h.isActive,
  images: h.images.map((i) => i.url),
  amenities: h.amenities.map((a) => a.name),
});

/** Rooms are their own entity (ROOM), so they're left out here. */
export const roomTypeSnapshot = (rt: AdminRoomType): AuditSnapshot => ({
  name: rt.name,
  description: rt.description,
  capacity: rt.capacity,
  basePrice: rt.basePrice,
  isActive: rt.isActive,
  images: rt.images.map((i) => i.url),
  amenities: rt.amenities.map((a) => a.name),
});

export const roomSnapshot = (r: { number: string; isActive: boolean }): AuditSnapshot => ({
  number: r.number,
  isActive: r.isActive,
});

export const ratePeriodSnapshot = (rp: AdminRatePeriod): AuditSnapshot => ({
  name: rp.name,
  startDate: rp.startDate,
  endDate: rp.endDate,
  price: rp.price,
});

export const amenitySnapshot = (a: Pick<AdminAmenity, "code" | "name" | "scope">): AuditSnapshot => ({
  code: a.code,
  name: a.name,
  scope: a.scope,
});

export const staffSnapshot = (s: AdminStaff): AuditSnapshot => ({
  name: s.name,
  email: s.email,
  phone: s.phone,
  hotels: s.hotels.map((h) => h.name),
});

/** `status` is the stage staff see: CONFIRMED + checked in reads CHECKED_IN. */
export const bookingSnapshot = (b: AdminBooking): AuditSnapshot => ({
  status: b.checkedIn ? "CHECKED_IN" : b.status,
  room: b.room.number,
  cancelReason: b.cancelReason,
  paymentStatus: b.payment?.status ?? null,
});

/** Staff only change whether a review shows. */
export const reviewSnapshot = (r: AdminReview): AuditSnapshot => ({ isHidden: r.isHidden });

export const roomLabel =(roomTypeName: string, number: string) => `${roomTypeName} · ${number}`;

export const ratePeriodLabel = (roomTypeName: string, rp: AdminRatePeriod) =>
  `${roomTypeName} · ${rp.name ?? `${rp.startDate} – ${rp.endDate}`}`;

// ---------- Diff ----------

const isEmpty = (v: AuditValue) => v === null || v === "" || (Array.isArray(v) && v.length === 0);

const sameValue = (a: AuditValue, b: AuditValue) =>
  (isEmpty(a) && isEmpty(b)) || JSON.stringify(a) === JSON.stringify(b);

/**
 * Fields whose value differs, in snapshot order. With `before` null (create) or `after` null (delete) that is
 * every field with a value; an empty value ("", [], null) counts as no value.
 */
export function diffSnapshots(before: AuditSnapshot | null, after: AuditSnapshot | null): AuditChange[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (!sameValue(from, to)) changes.push({ field, before: from, after: to });
  }
  return changes;
}

// ---------- Write ----------

type AuditEntry = {
  actor: PublicUser;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  hotelId: string | null;
  /** The room type, for a ROOM / RATE_PERIOD — its page shows the row too. */
  parentId?: string;
  /** Null for a create. */
  before: AuditSnapshot | null;
  /** Null for a delete. */
  after: AuditSnapshot | null;
};

/**
 * Records one change after the write has committed. An UPDATE that changed nothing is skipped.
 * Best effort: the change already happened, so a failed history insert is logged, never surfaced —
 * failing the request would make staff retry a write that went through.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const { actor, entityType, entityId, entityLabel, hotelId, parentId, before, after } = entry;
  if (before === null && after === null) return;
  const action = before === null ? "CREATE" : after === null ? "DELETE" : "UPDATE";
  const changes = diffSnapshots(before, after);
  if (action === "UPDATE" && changes.length === 0) return;
  try {
    await prisma.auditLog.create({
      data: { actorId: actor.id, action, entityType, entityId, entityLabel, hotelId, parentId, changes },
      select: { id: true },
    });
  } catch (err) {
    console.error(`recordAudit: could not record ${action} ${entityType} ${entityId}`, err);
  }
}

// ---------- Read ----------

const auditLogSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
  changes: true,
  createdAt: true,
  hotel: { select: { id: true, name: true } },
  actor: { select: { id: true, name: true, role: true } },
} satisfies Prisma.AuditLogSelect;

type AuditLogRow = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;

const changesSchema = z.array(auditChangeSchema);

function toAdminAuditLog(row: AuditLogRow): AdminAuditLog {
  // Written only by recordAudit; a row that doesn't parse (hand-edited) shows without its changes.
  const changes = changesSchema.safeParse(row.changes);
  return { ...row, changes: changes.success ? changes.data : [], createdAt: row.createdAt.toISOString() };
}

/** ADMIN see every row; STAFF only rows of hotels they're assigned to (so never amenity or staff rows). */
function visibleWhere(user: PublicUser): Prisma.AuditLogWhereInput {
  return user.role === "ADMIN" ? {} : { hotel: { staff: { some: { userId: user.id } } } };
}

export async function listAuditLogs(
  user: PublicUser,
  query: AdminAuditLogListQuery,
): Promise<Paginated<AdminAuditLog>> {
  const { hotelId, entityType, entityId, action, page, pageSize } = query;
  if (hotelId !== undefined && !(await canAccessHotel(user, hotelId))) {
    throw new AppError(403, "FORBIDDEN", "No access to this hotel");
  }
  const where: Prisma.AuditLogWhereInput = {
    AND: [
      visibleWhere(user),
      {
        ...(hotelId !== undefined && { hotelId }),
        // One entity's history: its own rows plus its children's (a room type's rooms and rate periods).
        ...(entityId !== undefined
          ? {
              OR: [
                { entityId, ...(entityType !== undefined && { entityType }) },
                { parentId: entityId },
              ],
            }
          : entityType !== undefined && { entityType }),
        ...(action !== undefined && { action }),
      },
    ],
  };
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: auditLogSelect,
    }),
  ]);
  return {
    items: rows.map(toAdminAuditLog),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
