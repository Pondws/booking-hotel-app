import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import {
  addRatePeriod,
  cleanupCatalogFixtures,
  createCatalogFixture,
  type CatalogFixture,
} from "../test/catalog-fixtures";
import { quoteStay, quoteStays } from "./pricing.service";

const LABEL = "quote";

describe("quoteStay / quoteStays", () => {
  let fx: CatalogFixture;
  let inactiveHotel: CatalogFixture;
  let [deluxe, suite, retired] = ["", "", ""];

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, {
      roomTypes: [
        { capacity: 2, basePrice: 3200, rooms: 1 },
        { capacity: 4, basePrice: "1999.50", rooms: 1 },
        { capacity: 2, basePrice: 100, rooms: 1, isActive: false },
      ],
    });
    [deluxe, suite, retired] = fx.roomTypes.map((r) => r.id);
    await addRatePeriod(deluxe, "2030-04-10", "2030-04-17", 4500);
    inactiveHotel = await createCatalogFixture(LABEL, {
      isActive: false,
      roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }],
    });
  });
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("quoteStay prices nights across a rate period start", async () => {
    const q = await quoteStay(deluxe, "2030-04-08", "2030-04-12");
    assert.deepEqual(q, {
      nights: 4,
      nightly: [
        { date: "2030-04-08", price: 3200 },
        { date: "2030-04-09", price: 3200 },
        { date: "2030-04-10", price: 4500 },
        { date: "2030-04-11", price: 4500 },
      ],
      total: 15400,
      currency: "THB",
    });
  });

  test("quoteStays returns a quote for every room type", async () => {
    const quotes = await quoteStays(
      [
        { id: deluxe, basePrice: new Prisma.Decimal(3200) },
        { id: suite, basePrice: new Prisma.Decimal("1999.50") },
      ],
      "THB",
      "2030-04-16",
      "2030-04-18",
    );
    assert.equal(quotes.size, 2);
    assert.deepEqual(
      quotes.get(deluxe)?.nightly.map((n) => n.price),
      [4500, 3200],
    );
    assert.equal(quotes.get(deluxe)?.total, 7700);
    assert.equal(quotes.get(suite)?.total, 3999);
    assert.equal(quotes.get(suite)?.currency, "THB");
  });

  const is404 = (e: unknown) =>
    e instanceof AppError && e.status === 404 && e.code === "NOT_FOUND" && e.message === "Room type not found";

  test("quoteStay rejects unknown room type with 404", async () => {
    await assert.rejects(quoteStay("nope", "2030-04-08", "2030-04-12"), is404);
  });

  test("quoteStay rejects an inactive room type with 404", async () => {
    await assert.rejects(quoteStay(retired, "2030-04-08", "2030-04-12"), is404);
  });

  test("quoteStay rejects a room type of an inactive hotel with 404", async () => {
    await assert.rejects(quoteStay(inactiveHotel.roomTypes[0].id, "2030-04-08", "2030-04-12"), is404);
  });
});
