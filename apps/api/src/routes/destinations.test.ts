import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { destinationListSchema } from "@booking/shared";
import { app } from "../app";
import { prisma } from "../lib/prisma";
import { cleanupCatalogFixtures, createCatalogFixture, type CatalogFixture } from "../test/catalog-fixtures";

const LABEL = "destinations";
const RUN = Date.now();
const BIG = `Dest Test Big ${RUN}`;
const SMALL = `Dest Test Small ${RUN}`;

describe("GET /api/destinations", () => {
  let best: CatalogFixture;

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    best = await createCatalogFixture(LABEL, {
      city: BIG,
      roomTypes: [
        { capacity: 2, basePrice: 1500, rooms: 1 },
        { capacity: 2, basePrice: 50, rooms: 1, isActive: false },
      ],
    });
    const other = await createCatalogFixture(LABEL, { city: BIG, roomTypes: [{ capacity: 2, basePrice: 900, rooms: 1 }] });
    await createCatalogFixture(LABEL, { city: BIG, isActive: false, roomTypes: [{ capacity: 2, basePrice: 100, rooms: 1 }] });
    await createCatalogFixture(LABEL, { city: SMALL, roomTypes: [{ capacity: 2, basePrice: 700, rooms: 1, isActive: false }] });
    await prisma.hotel.update({ where: { id: best.hotelId }, data: { ratingAvg: 4.8 } });
    await prisma.hotelImage.createMany({
      data: [
        { hotelId: other.hotelId, url: "https://img.test/other.jpg", alt: null, sortOrder: 0 },
        { hotelId: best.hotelId, url: "https://img.test/best.jpg", alt: "Best", sortOrder: 0 },
      ],
    });
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("one entry per city: active hotels only, cheapest active room type, best-rated cover", async () => {
    const res = await request(app).get("/api/destinations");
    assert.equal(res.status, 200);
    const list = destinationListSchema.parse(res.body.data);
    const big = list.find((d) => d.city === BIG);
    assert.deepEqual(big, {
      city: BIG,
      hotelCount: 2,
      fromPrice: 900,
      currency: "THB",
      coverImage: { url: "https://img.test/best.jpg", alt: "Best" },
    });
    // No active room type → listed, but without a price
    assert.deepEqual(list.find((d) => d.city === SMALL), {
      city: SMALL,
      hotelCount: 1,
      fromPrice: null,
      currency: "THB",
      coverImage: null,
    });
    // Most hotels first
    const counts = list.map((d) => d.hotelCount);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  });
});
