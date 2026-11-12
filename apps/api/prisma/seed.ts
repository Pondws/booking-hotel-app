import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.hotel.deleteMany();

  await prisma.hotel.create({
    data: {
      name: "Riverside Bangkok",
      city: "Bangkok",
      description: "Riverside hotel near the Chao Phraya.",
      rating: 4.5,
      rooms: {
        create: [
          { name: "Deluxe King", capacity: 2, pricePerNight: 3200 },
          { name: "Family Suite", capacity: 4, pricePerNight: 5800 },
        ],
      },
    },
  });
  await prisma.hotel.create({
    data: {
      name: "Old Town Chiang Mai",
      city: "Chiang Mai",
      description: "Boutique stay inside the old city walls.",
      rating: 4.2,
      rooms: { create: [{ name: "Garden Twin", capacity: 2, pricePerNight: 1900 }] },
    },
  });
  await prisma.hotel.create({
    data: {
      name: "Andaman Beach Resort",
      city: "Phuket",
      description: "Beachfront resort with pool villas.",
      rating: 4.8,
      rooms: { create: [{ name: "Pool Villa", capacity: 3, pricePerNight: 9500 }] },
    },
  });

  console.log("Seeded hotels:", await prisma.hotel.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
