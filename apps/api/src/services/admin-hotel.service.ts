import type {
  AdminHotel,
  AdminHotelListQuery,
  AdminHotelSummary,
  HotelAmenitiesInput,
  HotelContentData,
  HotelImagesInput,
  Paginated,
  PublicUser,
  UpdateHotelData,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import { imageOrder } from "../lib/image-order";
import { assertAmenityScope } from "./amenity.service";

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

// Explicit existence check so a missing hotel is a clean 404 (not a Prisma error) before any write.
export async function assertHotelExists(hotelId: string): Promise<void> {
  const found = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
  if (!found) throw new AppError(404, "NOT_FOUND", "Hotel not found");
}

/** Updates editable details only — slug and currency are never touched. */
export async function updateAdminHotel(hotelId: string, data: UpdateHotelData): Promise<AdminHotel> {
  await assertHotelExists(hotelId);
  const { name, city, address, description, checkInTime, checkOutTime } = data;
  await prisma.hotel.update({
    where: { id: hotelId },
    data: { name, city, address, description, checkInTime, checkOutTime },
  });
  return getAdminHotel(hotelId);
}

export async function replaceHotelImages(
  hotelId: string,
  input: HotelImagesInput,
): Promise<AdminHotel> {
  await assertHotelExists(hotelId);
  await prisma.$transaction([
    prisma.hotelImage.deleteMany({ where: { hotelId } }),
    prisma.hotelImage.createMany({
      data: input.images.map((img, index) => ({
        hotelId,
        url: img.url,
        alt: img.alt ?? null,
        sortOrder: index,
      })),
    }),
  ]);
  return getAdminHotel(hotelId);
}

/** Every id must exist and be a HOTEL-scope amenity (the DB doesn't check scope). Ids are unique (zod). */
export function assertHotelAmenityIds(amenityIds: string[]): Promise<void> {
  return assertAmenityScope(amenityIds, "HOTEL");
}

export async function replaceHotelAmenities(
  hotelId: string,
  input: HotelAmenitiesInput,
): Promise<AdminHotel> {
  await assertHotelExists(hotelId);
  await assertHotelAmenityIds(input.amenityIds);
  await prisma.$transaction([
    prisma.hotelAmenity.deleteMany({ where: { hotelId } }),
    prisma.hotelAmenity.createMany({
      data: input.amenityIds.map((amenityId) => ({ hotelId, amenityId })),
    }),
  ]);
  return getAdminHotel(hotelId);
}

/** Saves details, times, the ordered image list and the amenity set together — all or nothing. */
export async function saveHotelContent(hotelId: string, data: HotelContentData): Promise<AdminHotel> {
  await assertHotelExists(hotelId);
  await assertHotelAmenityIds(data.amenityIds);
  const { name, city, address, description, checkInTime, checkOutTime, images, amenityIds } = data;
  await prisma.$transaction([
    prisma.hotel.update({
      where: { id: hotelId },
      data: { name, city, address, description, checkInTime, checkOutTime },
    }),
    prisma.hotelImage.deleteMany({ where: { hotelId } }),
    prisma.hotelImage.createMany({
      data: images.map((img, index) => ({ hotelId, url: img.url, alt: img.alt ?? null, sortOrder: index })),
    }),
    prisma.hotelAmenity.deleteMany({ where: { hotelId } }),
    prisma.hotelAmenity.createMany({ data: amenityIds.map((amenityId) => ({ hotelId, amenityId })) }),
  ]);
  return getAdminHotel(hotelId);
}

export async function setHotelStatus(hotelId: string, isActive: boolean): Promise<AdminHotel> {
  await assertHotelExists(hotelId);
  await prisma.hotel.update({ where: { id: hotelId }, data: { isActive } });
  return getAdminHotel(hotelId);
}
