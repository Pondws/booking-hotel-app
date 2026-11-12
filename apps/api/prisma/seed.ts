import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { AmenityScope, PrismaClient, Role } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";
import { toSlug } from "../src/lib/slug";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEV_PASSWORD = "Password123!";

const amenitySeed = [
  { code: "wifi", name: "Wi-Fi", scope: AmenityScope.HOTEL },
  { code: "pool", name: "Swimming pool", scope: AmenityScope.HOTEL },
  { code: "parking", name: "Parking", scope: AmenityScope.HOTEL },
  { code: "breakfast", name: "Breakfast", scope: AmenityScope.HOTEL },
  { code: "aircon", name: "Air conditioning", scope: AmenityScope.ROOM },
  { code: "bathtub", name: "Bathtub", scope: AmenityScope.ROOM },
] as const;

interface RoomTypeSeed {
  name: string;
  description: string;
  capacity: number;
  basePrice: number;
  rooms: string[];
  amenities: string[];
}

interface HotelSeed {
  name: string;
  city: string;
  address: string;
  description: string;
  amenities: string[];
  roomTypes: RoomTypeSeed[];
}

const hotelSeed: HotelSeed[] = [
  {
    name: "Riverside Bangkok",
    city: "Bangkok",
    address: "123 Charoen Krung Rd, Bang Rak, Bangkok 10500",
    description: "Riverside hotel near the Chao Phraya.",
    amenities: ["wifi", "pool", "parking", "breakfast"],
    roomTypes: [
      {
        name: "Deluxe King",
        description: "King bed with river view.",
        capacity: 2,
        basePrice: 3200,
        rooms: ["101", "102", "103", "104"],
        amenities: ["aircon", "bathtub"],
      },
      {
        name: "Family Suite",
        description: "Two-bedroom suite for families.",
        capacity: 4,
        basePrice: 5800,
        rooms: ["201", "202"],
        amenities: ["aircon"],
      },
    ],
  },
  {
    name: "Old Town Chiang Mai",
    city: "Chiang Mai",
    address: "45 Ratchadamnoen Rd, Phra Sing, Chiang Mai 50200",
    description: "Boutique stay inside the old city walls.",
    amenities: ["wifi", "breakfast"],
    roomTypes: [
      {
        name: "Garden Twin",
        description: "Twin beds overlooking the garden.",
        capacity: 2,
        basePrice: 1900,
        rooms: ["1", "2", "3"],
        amenities: ["aircon"],
      },
    ],
  },
  {
    name: "Andaman Beach Resort",
    city: "Phuket",
    address: "9 Kata Beach Rd, Karon, Phuket 83100",
    description: "Beachfront resort with pool villas.",
    amenities: ["wifi", "pool", "parking"],
    roomTypes: [
      {
        name: "Pool Villa",
        description: "Private villa with its own pool.",
        capacity: 3,
        basePrice: 9500,
        rooms: ["V1", "V2"],
        amenities: ["aircon", "bathtub"],
      },
    ],
  },
];

async function main() {
  // Reverse dependency order because of the Restrict relations.
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ratePeriod.deleteMany();
  await prisma.roomTypeAmenity.deleteMany();
  await prisma.roomTypeImage.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.hotelAmenity.deleteMany();
  await prisma.hotelImage.deleteMany();
  await prisma.hotelStaff.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(DEV_PASSWORD);
  await prisma.user.create({
    data: { email: "admin@booking.local", name: "Admin", passwordHash, role: Role.ADMIN },
  });
  const staff = await prisma.user.create({
    data: { email: "staff@booking.local", name: "Staff", passwordHash, role: Role.STAFF },
  });
  const customer = await prisma.user.create({
    data: {
      email: "customer@booking.local",
      name: "Customer",
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const amenityIds = new Map<string, string>();
  for (const a of amenitySeed) {
    const created = await prisma.amenity.create({ data: a });
    amenityIds.set(a.code, created.id);
  }
  const amenityId = (code: string): string => {
    const id = amenityIds.get(code);
    if (!id) throw new Error(`Unknown amenity ${code}`);
    return id;
  };

  const hotelIds = new Map<string, string>();
  const roomTypeIds = new Map<string, string>();
  const roomIds = new Map<string, string>();

  for (const h of hotelSeed) {
    const slug = toSlug(h.name);
    const hotel = await prisma.hotel.create({
      data: {
        name: h.name,
        slug,
        city: h.city,
        address: h.address,
        description: h.description,
        images: {
          create: [1, 2].map((n) => ({
            url: `https://picsum.photos/seed/${slug}-${n}/800/600`,
            alt: h.name,
            sortOrder: n - 1,
          })),
        },
        amenities: { create: h.amenities.map((code) => ({ amenityId: amenityId(code) })) },
      },
    });
    hotelIds.set(h.name, hotel.id);

    for (const rt of h.roomTypes) {
      const rtSlug = toSlug(`${h.name} ${rt.name}`);
      const roomType = await prisma.roomType.create({
        data: {
          hotelId: hotel.id,
          name: rt.name,
          description: rt.description,
          capacity: rt.capacity,
          basePrice: rt.basePrice,
          images: {
            create: [1, 2].map((n) => ({
              url: `https://picsum.photos/seed/${rtSlug}-${n}/800/600`,
              alt: rt.name,
              sortOrder: n - 1,
            })),
          },
          amenities: { create: rt.amenities.map((code) => ({ amenityId: amenityId(code) })) },
          rooms: { create: rt.rooms.map((number) => ({ number })) },
        },
        include: { rooms: true },
      });
      roomTypeIds.set(`${h.name}/${rt.name}`, roomType.id);
      for (const room of roomType.rooms) {
        roomIds.set(`${h.name}/${rt.name}/${room.number}`, room.id);
      }
    }
  }

  const riversideId = hotelIds.get("Riverside Bangkok");
  const deluxeKingId = roomTypeIds.get("Riverside Bangkok/Deluxe King");
  const room101Id = roomIds.get("Riverside Bangkok/Deluxe King/101");
  if (!riversideId || !deluxeKingId || !room101Id) throw new Error("Seed lookup failed");

  await prisma.hotelStaff.create({ data: { userId: staff.id, hotelId: riversideId } });

  await prisma.ratePeriod.create({
    data: {
      roomTypeId: deluxeKingId,
      name: "Songkran",
      startDate: new Date("2027-04-10"),
      endDate: new Date("2027-04-17"),
      price: 4500,
    },
  });

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        code: "BKSEED01",
        userId: customer.id,
        roomId: room101Id,
        guestName: customer.name,
        guestEmail: customer.email,
        guests: 2,
        checkIn: new Date("2026-10-01"),
        checkOut: new Date("2026-10-03"),
        status: "COMPLETED",
        totalAmount: 6400,
        currency: "THB",
      },
    });
    await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: 6400,
        currency: "THB",
        status: "SUCCEEDED",
        provider: "seed",
        providerRef: "seed-payment-1",
        paidAt: new Date("2026-09-30T10:00:00Z"),
      },
    });
    await tx.review.create({
      data: {
        bookingId: booking.id,
        userId: customer.id,
        hotelId: riversideId,
        rating: 5,
        comment: "Lovely stay by the river.",
      },
    });
    await tx.hotel.update({
      where: { id: riversideId },
      data: { ratingAvg: 5, reviewCount: 1 },
    });
  });

  console.log("Seeded:", {
    users: await prisma.user.count(),
    hotels: await prisma.hotel.count(),
    roomTypes: await prisma.roomType.count(),
    rooms: await prisma.room.count(),
    amenities: await prisma.amenity.count(),
    ratePeriods: await prisma.ratePeriod.count(),
    bookings: await prisma.booking.count(),
    payments: await prisma.payment.count(),
    reviews: await prisma.review.count(),
  });
  console.log(`Dev login password for all seeded users: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
