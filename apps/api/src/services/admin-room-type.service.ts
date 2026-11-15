import type {
  AdminRoomType,
  AdminRoomTypeSummary,
  RoomTypeData,
  UpdateRoomData,
} from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { imageOrder } from "../lib/image-order";
import { toPrice } from "../lib/money";
import { prisma } from "../lib/prisma";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { assertHotelExists } from "./admin-hotel.service";
import { assertAmenityScope } from "./amenity.service";

const adminRoomTypeSelect = {
  id: true,
  name: true,
  description: true,
  capacity: true,
  basePrice: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { id: true, name: true, currency: true } },
  images: {
    select: { id: true, url: true, alt: true, sortOrder: true },
    orderBy: [...imageOrder],
  },
  amenities: {
    select: { amenity: { select: { id: true, code: true, name: true } } },
    orderBy: { amenity: { name: "asc" } },
  },
  rooms: {
    select: { id: true, number: true, isActive: true },
    orderBy: [{ number: "asc" }, { id: "asc" }],
  },
  _count: { select: { ratePeriods: true } },
} satisfies Prisma.RoomTypeSelect;

type AdminRoomTypeRow = Prisma.RoomTypeGetPayload<{ select: typeof adminRoomTypeSelect }>;

function toAdminRoomType(row: AdminRoomTypeRow): AdminRoomType {
  const { _count, ...rest } = row;
  return {
    ...rest,
    basePrice: row.basePrice.toNumber(),
    amenities: row.amenities.map((a) => a.amenity),
    deletable: row.rooms.length === 0 && _count.ratePeriods === 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const notFound = () => new AppError(404, "NOT_FOUND", "Room type not found");

export async function listRoomTypes(hotelId: string): Promise<AdminRoomTypeSummary[]> {
  await assertHotelExists(hotelId);
  const rows = await prisma.roomType.findMany({
    where: { hotelId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      capacity: true,
      basePrice: true,
      isActive: true,
      updatedAt: true,
      images: { select: { url: true, alt: true }, orderBy: [...imageOrder], take: 1 },
      rooms: { select: { isActive: true } },
    },
  });
  return rows.map((rt) => ({
    id: rt.id,
    name: rt.name,
    capacity: rt.capacity,
    basePrice: rt.basePrice.toNumber(),
    isActive: rt.isActive,
    roomCount: rt.rooms.length,
    activeRoomCount: rt.rooms.filter((r) => r.isActive).length,
    coverImage: rt.images[0] ?? null,
    updatedAt: rt.updatedAt.toISOString(),
  }));
}

/** The room type, only if it belongs to `hotelId` — otherwise 404 (also for an unknown hotel). */
export async function getRoomType(hotelId: string, roomTypeId: string): Promise<AdminRoomType> {
  const row = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId },
    select: adminRoomTypeSelect,
  });
  if (!row) throw notFound();
  return toAdminRoomType(row);
}

export async function assertRoomTypeInHotel(hotelId: string, roomTypeId: string): Promise<void> {
  const found = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId },
    select: { id: true },
  });
  if (!found) throw notFound();
}

function imageRows(roomTypeId: string, images: RoomTypeData["images"]) {
  return images.map((img, index) => ({
    roomTypeId,
    url: img.url,
    alt: img.alt ?? null,
    sortOrder: index,
  }));
}

export async function createRoomType(hotelId: string, data: RoomTypeData): Promise<AdminRoomType> {
  await assertHotelExists(hotelId);
  await assertAmenityScope(data.amenityIds, "ROOM");
  const { name, description, capacity, basePrice, images, amenityIds } = data;
  const id = await prisma.$transaction(async (tx) => {
    const roomType = await tx.roomType.create({
      data: { hotelId, name, description, capacity, basePrice: toPrice(basePrice) },
      select: { id: true },
    });
    await tx.roomTypeImage.createMany({ data: imageRows(roomType.id, images) });
    await tx.roomTypeAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ roomTypeId: roomType.id, amenityId })),
    });
    return roomType.id;
  });
  return getRoomType(hotelId, id);
}

/** Replaces details, the ordered image list and the amenity set — all or nothing. */
export async function saveRoomType(
  hotelId: string,
  roomTypeId: string,
  data: RoomTypeData,
): Promise<AdminRoomType> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  await assertAmenityScope(data.amenityIds, "ROOM");
  const { name, description, capacity, basePrice, images, amenityIds } = data;
  await prisma.$transaction([
    prisma.roomType.update({
      where: { id: roomTypeId },
      data: { name, description, capacity, basePrice: toPrice(basePrice) },
    }),
    prisma.roomTypeImage.deleteMany({ where: { roomTypeId } }),
    prisma.roomTypeImage.createMany({ data: imageRows(roomTypeId, images) }),
    prisma.roomTypeAmenity.deleteMany({ where: { roomTypeId } }),
    prisma.roomTypeAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ roomTypeId, amenityId })),
    }),
  ]);
  return getRoomType(hotelId, roomTypeId);
}

export async function setRoomTypeStatus(
  hotelId: string,
  roomTypeId: string,
  isActive: boolean,
): Promise<AdminRoomType> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  await prisma.roomType.update({ where: { id: roomTypeId }, data: { isActive } });
  return getRoomType(hotelId, roomTypeId);
}

/** Only while no rooms or rate periods depend on it (both are `onDelete: Restrict`). */
export async function deleteRoomType(hotelId: string, roomTypeId: string): Promise<void> {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId },
    select: { _count: { select: { rooms: true, ratePeriods: true } } },
  });
  if (!roomType) throw notFound();
  if (roomType._count.rooms > 0 || roomType._count.ratePeriods > 0) {
    throw new AppError(
      409,
      "CONFLICT",
      "This room type has rooms or rates, so it can't be deleted. Deactivate it instead.",
    );
  }
  // Images and amenity links cascade
  await prisma.roomType.delete({ where: { id: roomTypeId } });
}

const duplicateNumber = (number: string) =>
  new AppError(409, "CONFLICT", `Room ${number} already exists in this hotel`);

/** Room numbers are unique per hotel (the DB only enforces it per room type). */
async function assertNumberFree(hotelId: string, number: string, exceptRoomId?: string) {
  const taken = await prisma.room.findFirst({
    where: {
      number: { equals: number, mode: "insensitive" },
      roomType: { hotelId },
      ...(exceptRoomId !== undefined && { NOT: { id: exceptRoomId } }),
    },
    select: { id: true },
  });
  if (taken) throw duplicateNumber(number);
}

/** The DB unique index is the backstop for two concurrent adds of the same number. */
async function withDuplicateCheck(number: string, write: () => Promise<unknown>): Promise<void> {
  try {
    await write();
  } catch (err) {
    if (isUniqueViolationOn(err, "number")) throw duplicateNumber(number);
    throw err;
  }
}

export async function addRoom(
  hotelId: string,
  roomTypeId: string,
  number: string,
): Promise<AdminRoomType> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  await assertNumberFree(hotelId, number);
  await withDuplicateCheck(number, () => prisma.room.create({ data: { roomTypeId, number } }));
  return getRoomType(hotelId, roomTypeId);
}

/** Rename and/or (de)activate. Existing bookings keep the room. */
export async function updateRoom(
  hotelId: string,
  roomTypeId: string,
  roomId: string,
  data: UpdateRoomData,
): Promise<AdminRoomType> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  const room = await prisma.room.findFirst({ where: { id: roomId, roomTypeId }, select: { id: true } });
  if (!room) throw new AppError(404, "NOT_FOUND", "Room not found");
  const { number, isActive } = data;
  if (number !== undefined) await assertNumberFree(hotelId, number, roomId);
  await withDuplicateCheck(number ?? "", () =>
    prisma.room.update({ where: { id: roomId }, data: { number, isActive } }),
  );
  return getRoomType(hotelId, roomTypeId);
}
