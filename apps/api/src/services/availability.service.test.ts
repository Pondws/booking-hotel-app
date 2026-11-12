import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { prisma } from "../lib/prisma";
import {
  addBooking,
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  type CatalogFixture,
} from "../test/catalog-fixtures";
import { availableRoomCounts } from "./availability.service";

const LABEL = "avail";
const IN = "2030-01-10";
const OUT = "2030-01-12";
const minutes = (n: number) => new Date(Date.now() + n * 60_000);

describe("availableRoomCounts", () => {
  let fx: CatalogFixture;
  let rt: string;
  let [r1, r2] = ["", ""];

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, {
      roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 2, inactiveRooms: 1 }],
    });
    rt = fx.roomTypes[0].id;
    [r1, r2] = fx.roomTypes[0].roomIds;
  });
  afterEach(() => clearBookings(fx));
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  const count = async () => (await availableRoomCounts([rt], IN, OUT)).get(rt);

  test("no bookings → active rooms only (inactive room not counted)", async () => {
    assert.equal(await count(), 2);
  });

  test("a CONFIRMED overlapping booking blocks one room", async () => {
    await addBooking(fx, r1, "2030-01-11", "2030-01-13", "CONFIRMED");
    assert.equal(await count(), 1);
  });

  test("CONFIRMED + non-expired PENDING block both rooms", async () => {
    await addBooking(fx, r1, IN, OUT, "CONFIRMED");
    await addBooking(fx, r2, "2030-01-09", "2030-01-11", "PENDING", minutes(10));
    assert.equal(await count(), 0);
  });

  test("PENDING with no expiry blocks", async () => {
    await addBooking(fx, r1, IN, OUT, "PENDING", null);
    assert.equal(await count(), 1);
  });

  test("expired PENDING, CANCELLED, EXPIRED and COMPLETED never block", async () => {
    for (const room of [r1, r2]) {
      await addBooking(fx, room, IN, OUT, "PENDING", minutes(-1));
      await addBooking(fx, room, IN, OUT, "CANCELLED");
      await addBooking(fx, room, IN, OUT, "EXPIRED");
      await addBooking(fx, room, IN, OUT, "COMPLETED");
    }
    assert.equal(await count(), 2);
  });

  test("adjacent stays (back-to-back) don't block", async () => {
    await addBooking(fx, r1, "2030-01-08", IN, "CONFIRMED");
    await addBooking(fx, r2, OUT, "2030-01-14", "CONFIRMED");
    assert.equal(await count(), 2);
  });

  test("unknown room type id maps to 0", async () => {
    const counts = await availableRoomCounts([rt, "nope"], IN, OUT);
    assert.equal(counts.get("nope"), 0);
    assert.equal(counts.get(rt), 2);
  });

  test("empty input → empty map", async () => {
    assert.equal((await availableRoomCounts([], IN, OUT)).size, 0);
  });
});
