import type { AmenityOption, AmenityScope } from "@booking/shared";
import { prisma } from "../lib/prisma";

export async function listAmenities(scope?: AmenityScope): Promise<AmenityOption[]> {
  return prisma.amenity.findMany({
    where: scope ? { scope } : {},
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, code: true, name: true, scope: true },
  });
}
