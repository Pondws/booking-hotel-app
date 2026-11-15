import type {
  AdminHotel,
  AdminHotelListQuery,
  AdminHotelSummary,
  Paginated,
  PublicUser,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import { imageOrder } from "./hotel.service";

export const adminHotelSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  address: true,
  description: true,
  currency: true,
  checkInTime: true,
  checkOutTime: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: { id: true, url: true, alt: true, sortOrder: true },
    orderBy: [...imageOrder],
  },
  amenities: {
    select: { amenity: { select: { id: true, code: true, name: true } } },
    orderBy: { amenity: { name: "asc" } },
  },
} satisfies Prisma.HotelSelect;

export type AdminHotelRow = Prisma.HotelGetPayload<{ select: typeof adminHotelSelect }>;

export function toAdminHotel(row: AdminHotelRow): AdminHotel {
  return {
    ...row,
    amenities: row.amenities.map((a) => a.amenity),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminHotels(
  user: PublicUser,
  query: AdminHotelListQuery,
): Promise<Paginated<AdminHotelSummary>> {
  const { q, status, page, pageSize } = query;
  const where: Prisma.HotelWhereInput = {
    ...(user.role === "STAFF" && { staff: { some: { userId: user.id } } }),
    ...(q !== undefined && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(status !== "all" && { isActive: status === "active" }),
  };

  const [total, hotels] = await prisma.$transaction([
    prisma.hotel.count({ where }),
    prisma.hotel.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        isActive: true,
        updatedAt: true,
        images: { select: { url: true, alt: true }, orderBy: [...imageOrder], take: 1 },
      },
    }),
  ]);

  return {
    items: hotels.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      city: h.city,
      isActive: h.isActive,
      coverImage: h.images[0] ?? null,
      updatedAt: h.updatedAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAdminHotel(hotelId: string): Promise<AdminHotel> {
  const row = await prisma.hotel.findUnique({ where: { id: hotelId }, select: adminHotelSelect });
  if (!row) throw new AppError(404, "NOT_FOUND", "Hotel not found");
  return toAdminHotel(row);
}
