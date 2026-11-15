import type { AmenityOption, AmenityScope } from "@booking/shared";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";

export async function listAmenities(scope?: AmenityScope): Promise<AmenityOption[]> {
  return prisma.amenity.findMany({
    where: scope ? { scope } : {},
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, code: true, name: true, scope: true },
  });
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
