import type {
  AdminAmenity,
  AmenityScope,
  CreateAmenityData,
  UpdateAmenityData,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { prisma } from "../lib/prisma";

const adminAmenitySelect = {
  id: true,
  code: true,
  name: true,
  scope: true,
  _count: { select: { hotels: true, roomTypes: true } },
} as const satisfies Prisma.AmenitySelect;

type AmenityRow = Prisma.AmenityGetPayload<{ select: typeof adminAmenitySelect }>;

function toAdminAmenity({ _count, ...a }: AmenityRow): AdminAmenity {
  return { ...a, hotelCount: _count.hotels, roomTypeCount: _count.roomTypes };
}

export async function listAmenities(scope?: AmenityScope): Promise<AdminAmenity[]> {
  const rows = await prisma.amenity.findMany({
    where: scope ? { scope } : {},
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: adminAmenitySelect,
  });
  return rows.map(toAdminAmenity);
}

/** Duplicate `code` → 409 with the message on the field, so the form shows it there. */
function rethrowCodeConflict(err: unknown, code: string): never {
  if (isUniqueViolationOn(err, "code")) {
    const message = `The code "${code}" is already used`;
    throw new AppError(409, "CONFLICT", message, { formErrors: [], fieldErrors: { code: [message] } });
  }
  throw err;
}

export async function createAmenity(data: CreateAmenityData): Promise<AdminAmenity> {
  try {
    return toAdminAmenity(await prisma.amenity.create({ data, select: adminAmenitySelect }));
  } catch (err) {
    rethrowCodeConflict(err, data.code);
  }
}

/** Scope never changes: existing hotel / room type links would end up in the wrong scope. */
export async function updateAmenity(amenityId: string, data: UpdateAmenityData): Promise<AdminAmenity> {
  const exists = await prisma.amenity.count({ where: { id: amenityId } });
  if (exists === 0) throw new AppError(404, "NOT_FOUND", "Amenity not found");
  try {
    const row = await prisma.amenity.update({
      where: { id: amenityId },
      data: { code: data.code, name: data.name },
      select: adminAmenitySelect,
    });
    return toAdminAmenity(row);
  } catch (err) {
    rethrowCodeConflict(err, data.code);
  }
}

/** Hotel / room type links cascade — the UI warns with the usage counts first. */
export async function deleteAmenity(amenityId: string): Promise<void> {
  const { count } = await prisma.amenity.deleteMany({ where: { id: amenityId } });
  if (count === 0) throw new AppError(404, "NOT_FOUND", "Amenity not found");
}

const SCOPE_MESSAGE: Record<AmenityScope, string> = {
  HOTEL: "Only hotel amenities can be added",
  ROOM: "Only room amenities can be added",
};

/**
 * Every id must exist and have `scope` (the DB doesn't check scope). Ids are unique (zod).
 * Fails as a 400 with the message on `amenityIds`, so forms can show it under the field.
 */
export async function assertAmenityScope(amenityIds: string[], scope: AmenityScope): Promise<void> {
  if (amenityIds.length === 0) return;
  const amenities = await prisma.amenity.findMany({
    where: { id: { in: amenityIds } },
    select: { scope: true },
  });
  if (amenities.length !== amenityIds.length || amenities.some((a) => a.scope !== scope)) {
    const message = SCOPE_MESSAGE[scope];
    throw new AppError(400, "VALIDATION_FAILED", message, {
      formErrors: [],
      fieldErrors: { amenityIds: [message] },
    });
  }
}
