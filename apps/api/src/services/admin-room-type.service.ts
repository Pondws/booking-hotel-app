import type {
  AdminRoomType,
  PublicUser,
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
import { recordAudit, roomLabel, roomSnapshot, roomTypeSnapshot } from "./audit.service";

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

/** Reads the room type as it is now, records the change from `before` (null = just created) and returns it. */
async function auditRoomType(
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  before: AdminRoomType | null,
): Promise<AdminRoomType> {
  const after = await getRoomType(hotelId, roomTypeId);
  await recordAudit({
    actor,
    entityType: "ROOM_TYPE",
    entityId: roomTypeId,
    entityLabel: after.name,
    hotelId,
    before: before && roomTypeSnapshot(before),
    after: roomTypeSnapshot(after),
  });
  return after;
}

function imageRows(roomTypeId: string, images: RoomTypeData["images"]) {
  return images.map((img, index) => ({
    roomTypeId,
    url: img.url,
    alt: img.alt ?? null,
    sortOrder: index,
  }));
}

export async function createRoomType(
  actor: PublicUser,
  hotelId: string,
  data: RoomTypeData,
): Promise<AdminRoomType> {
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
  return auditRoomType(actor, hotelId, id, null);
}

/** Replaces details, the ordered image list and the amenity set — all or nothing. */
export async function saveRoomType(
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  data: RoomTypeData,
): Promise<AdminRoomType> {
  const before = await getRoomType(hotelId, roomTypeId);
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
  return auditRoomType(actor, hotelId, roomTypeId, before);
}

export async function setRoomTypeStatus(
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  isActive: boolean,
): Promise<AdminRoomType> {
  const before = await getRoomType(hotelId, roomTypeId);
  await prisma.roomType.update({ where: { id: roomTypeId }, data: { isActive } });
  return auditRoomType(actor, hotelId, roomTypeId, before);
}

/** Only while no rooms or rate periods depend on it (both are `onDelete: Restrict`). */
export async function deleteRoomType(actor: PublicUser, hotelId: string, roomTypeId: string): Promise<void> {
  const before = await getRoomType(hotelId, roomTypeId);
  if (!before.deletable) {
    throw new AppError(
      409,
      "CONFLICT",
      "This room type has rooms or rates, so it can't be deleted. Deactivate it instead.",
    );
  }
  // Images and amenity links cascade
  await prisma.roomType.delete({ where: { id: roomTypeId } });
  await recordAudit({
    actor,
    entityType: "ROOM_TYPE",
    entityId: roomTypeId,
    entityLabel: before.name,
    hotelId,
    before: roomTypeSnapshot(before),
    after: null,
  });
}

const roomAuditSelect = {
  id: true,
  number: true,
  isActive: true,
  roomType: { select: { id: true, name: true } },
} satisfies Prisma.RoomSelect;

type RoomAuditRow = Prisma.RoomGetPayload<{ select: typeof roomAuditSelect }>;

function auditRoom(actor: PublicUser, hotelId: string, before: RoomAuditRow | null, after: RoomAuditRow) {
  return recordAudit({
    actor,
    entityType: "ROOM",
    entityId: after.id,
    entityLabel: roomLabel(after.roomType.name, after.number),
    hotelId,
    parentId: after.roomType.id,
    before: before && roomSnapshot(before),
    after: roomSnapshot(after),
  });
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
async function withDuplicateCheck<T>(number: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (isUniqueViolationOn(err, "number")) throw duplicateNumber(number);
    throw err;
  }
}

export async function addRoom(
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  number: string,
): Promise<AdminRoomType> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  await assertNumberFree(hotelId, number);
  const room = await withDuplicateCheck(number, () =>
    prisma.room.create({ data: { roomTypeId, number }, select: roomAuditSelect }),
  );
  await auditRoom(actor, hotelId, null, room);
  return getRoomType(hotelId, roomTypeId);
}

/** Rename and/or (de)activate. Existing bookings keep the room. */
export async function updateRoom(
  actor: PublicUser,
  hotelId: string,
  roomTypeId: string,
  roomId: string,
  data: UpdateRoomData,
): Promise<AdminRoomType> {
  await assertRoomTypeInHotel(hotelId, roomTypeId);
  const before = await prisma.room.findFirst({ where: { id: roomId, roomTypeId }, select: roomAuditSelect });
  if (!before) throw new AppError(404, "NOT_FOUND", "Room not found");
  const { number, isActive } = data;
  if (number !== undefined) await assertNumberFree(hotelId, number, roomId);
  const after = await withDuplicateCheck(number ?? "", () =>
    prisma.room.update({ where: { id: roomId }, data: { number, isActive }, select: roomAuditSelect }),
  );
  await auditRoom(actor, hotelId, before, after);
  return getRoomType(hotelId, roomTypeId);
}
