import type { CreateHotelData } from "@booking/shared";
import { Prisma, type Hotel } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { toSlug, withSuffix } from "../lib/slug";

export type { Hotel };

export function listActiveHotels(): Promise<Hotel[]> {
  return prisma.hotel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

async function nextSlug(name: string): Promise<string> {
  const base = toSlug(name);
  const existing = await prisma.hotel.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  return withSuffix(
    base,
    existing.map((h) => h.slug),
  );
}

export async function createHotel(input: CreateHotelData): Promise<Hotel> {
  try {
    return await prisma.hotel.create({ data: { ...input, slug: await nextSlug(input.name) } });
  } catch (err) {
    // Lost a slug race with a concurrent create: recompute once and retry.
    // A second P2002 propagates and becomes 409 CONFLICT.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.hotel.create({ data: { ...input, slug: await nextSlug(input.name) } });
    }
    throw err;
  }
}
