/**
 * Test-only builders for catalog/availability integration tests.
 * Every row hangs off a hotel named `Cat Test <label> <ts>` (or a user `cat-test+<label>-<ts>@test.local`),
 * so `cleanupCatalogFixtures(label)` removes exactly what one test file created — test files run in
 * parallel, so cleanup must never touch another file's label.
 */
import type { PublicUser } from "@booking/shared";
import { BookingStatus, Prisma } from "../generated/prisma/client";
import { toDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";

export const CATALOG_PREFIX = "Cat Test ";

const hotelPrefix = (label: string) => `${CATALOG_PREFIX}${label} `;
const userPrefix = (label: string) => `cat-test+${label}-`;

let seq = 0;
const unique = () => `${Date.now()}-${process.pid}-${++seq}`;

export type RoomTypeSpec = {
  name?: string;
  capacity: number;
  basePrice: number | string;
  isActive?: boolean;
  /** Active rooms to create. */
  rooms: number;
  /** Extra inactive rooms to create. */
  inactiveRooms?: number;
};

export type CatalogFixture = {
  hotelId: string;
  slug: string;
  name: string;
  city: string;
  userId: string;
  roomTypes: { id: string; roomIds: string[]; inactiveRoomIds: string[] }[];
};

export async function createCatalogFixture(
  label: string,
  opts: { city?: string; isActive?: boolean; roomTypes: RoomTypeSpec[] },
): Promise<CatalogFixture> {
  const id = unique();
  const name = `${hotelPrefix(label)}${id}`;
  const city = opts.city ?? `${CATALOG_PREFIX}City ${id}`;
  const hotel = await prisma.hotel.create({
    data: {
      name,
      slug: `cat-test-${label}-${id}`.toLowerCase(),
      city,
      address: "1 Fixture Road",
      isActive: opts.isActive ?? true,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `${userPrefix(label)}${id}@test.local`,
      passwordHash: "x",
      name: `${CATALOG_PREFIX}User`,
    },
  });

  const roomTypes: CatalogFixture["roomTypes"] = [];
  for (const [i, spec] of opts.roomTypes.entries()) {
    const rt = await prisma.roomType.create({
      data: {
        hotelId: hotel.id,
        name: spec.name ?? `Type ${i + 1}`,
        capacity: spec.capacity,
        basePrice: new Prisma.Decimal(spec.basePrice),
        isActive: spec.isActive ?? true,
      },
    });
    const make = async (count: number, isActive: boolean, offset: number) => {
      const ids: string[] = [];
      for (let n = 0; n < count; n++) {
        const room = await prisma.room.create({
          data: { roomTypeId: rt.id, number: `${i + 1}${String(offset + n + 1).padStart(2, "0")}`, isActive },
        });
        ids.push(room.id);
      }
      return ids;
    };
    const roomIds = await make(spec.rooms, true, 0);
    const inactiveRoomIds = await make(spec.inactiveRooms ?? 0, false, spec.rooms);
    roomTypes.push({ id: rt.id, roomIds, inactiveRoomIds });
  }

  return { hotelId: hotel.id, slug: hotel.slug, name, city, userId: user.id, roomTypes };
}

export function addRatePeriod(
  roomTypeId: string,
  startDate: string,
  endDate: string,
  price: number | string,
) {
  return prisma.ratePeriod.create({
    data: {
      roomTypeId,
      startDate: toDbDate(startDate),
      endDate: toDbDate(endDate),
      price: new Prisma.Decimal(price),
    },
  });
}

export function addBooking(
  fx: CatalogFixture,
  roomId: string,
  checkIn: string,
  checkOut: string,
  status: BookingStatus,
  expiresAt: Date | null = null,
) {
  return prisma.booking.create({
    data: {
      code: `CAT-${unique()}`,
      userId: fx.userId,
      roomId,
      guestName: "Fixture Guest",
      guestEmail: "guest@test.local",
      guests: 1,
      checkIn: toDbDate(checkIn),
      checkOut: toDbDate(checkOut),
      status,
      totalAmount: new Prisma.Decimal(0),
      currency: "THB",
      expiresAt,
    },
  });
}

/** A standalone customer under `label` (removed by `cleanupCatalogFixtures(label)`). */
export function createFixtureUser(label: string): Promise<PublicUser> {
  return prisma.user.create({
    data: {
      email: `${userPrefix(label)}${unique()}@test.local`,
      passwordHash: "x",
      name: `${CATALOG_PREFIX}Customer`,
    },
    select: { id: true, email: true, name: true, phone: true, role: true },
  });
}

/** Deletes the bookings of one fixture — its user's and any on its rooms (to reset between tests). */
export function clearBookings(fx: CatalogFixture) {
  return prisma.booking.deleteMany({
    where: { OR: [{ userId: fx.userId }, { room: { roomType: { hotelId: fx.hotelId } } }] },
  });
}

/** Deletes every row created under `label`, in reverse FK order. */
export async function cleanupCatalogFixtures(label: string): Promise<void> {
  const hotel = { name: { startsWith: hotelPrefix(label) } };
  const roomType = { hotel };
  await prisma.booking.deleteMany({ where: { room: { roomType } } });
  await prisma.booking.deleteMany({ where: { user: { email: { startsWith: userPrefix(label) } } } });
  await prisma.ratePeriod.deleteMany({ where: { roomType } });
  await prisma.room.deleteMany({ where: { roomType } });
  await prisma.roomType.deleteMany({ where: roomType });
  await prisma.hotel.deleteMany({ where: hotel });
  await prisma.user.deleteMany({ where: { email: { startsWith: userPrefix(label) } } });
}
