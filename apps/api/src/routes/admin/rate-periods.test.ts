import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import {
  adminRatePeriodListSchema,
  adminRatePeriodSchema,
  adminRoomTypeSchema,
  availabilitySchema,
  type PublicUser,
  type RatePeriodInput,
} from "@booking/shared";
import { app } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  addRatePeriod,
  assignStaff,
  cleanupCatalogFixtures,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../../test/catalog-fixtures";

const LABEL = "admin-rate-periods";

describe("admin rate periods API", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let staff: PublicUser;
  let staffCookie = "";
  let adminCookie = "";
  let webCookie = "";

  type Method = "get" | "post" | "put" | "delete";
  const send = (method: Method, path: string, body?: object, cookie = staffCookie) => {
    const req = request(app)[method](path).set("Cookie", cookie);
    return body === undefined ? req : req.send(body);
  };

  const input = (overrides: Partial<RatePeriodInput> = {}): RatePeriodInput => ({
    name: "High season",
    startDate: "2027-06-10",
    endDate: "2027-06-15",
    price: 1500.5,
    ...overrides,
  });

  const base = (fx: CatalogFixture, index = 0) =>
    `/api/admin/hotels/${fx.hotelId}/room-types/${fx.roomTypes[index]!.id}/rate-periods`;

  const clearPeriods = () =>
    prisma.ratePeriod.deleteMany({
      where: { roomTypeId: { in: [...mine.roomTypes, ...other.roomTypes].map((rt) => rt.id) } },
    });

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    mine = await createCatalogFixture(LABEL, {
      roomTypes: [
        { name: "Standard", capacity: 2, basePrice: 1000, rooms: 1 },
        { name: "Suite", capacity: 4, basePrice: 5000, rooms: 1 },
      ],
    });
    other = await createCatalogFixture(LABEL, {
      roomTypes: [{ name: "Other", capacity: 2, basePrice: 900, rooms: 1 }],
    });
    staff = await createFixtureUser(LABEL, "STAFF");
    const admin = await createFixtureUser(LABEL, "ADMIN");
    await assignStaff(staff.id, mine.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
    webCookie = `sid=${await signIn(staff.id, "WEB")}`;
  });

  beforeEach(clearPeriods);

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  describe("access", () => {
    test("staff on an unassigned hotel → 403 for every endpoint", async () => {
      const period = await addRatePeriod(other.roomTypes[0]!.id, "2027-06-01", "2027-06-05", 1200);
      const url = base(other);
      const calls = [
        send("get", url),
        send("post", url, input()),
        send("put", `${url}/${period.id}`, input()),
        send("delete", `${url}/${period.id}`),
      ];
      for (const res of await Promise.all(calls)) assert.equal(res.status, 403);
    });

    test("web session → 401", async () => {
      assert.equal((await send("get", base(mine), undefined, webCookie)).status, 401);
    });

    test("a room type of another hotel through my hotel's URL → 404", async () => {
      const url = `/api/admin/hotels/${mine.hotelId}/room-types/${other.roomTypes[0]!.id}/rate-periods`;
      assert.equal((await send("get", url)).status, 404);
      assert.equal((await send("post", url, input())).status, 404);
    });

    test("a period of another room type through this room type's URL → 404", async () => {
      const suitePeriod = await addRatePeriod(mine.roomTypes[1]!.id, "2027-06-01", "2027-06-05", 6000);
      const url = `${base(mine)}/${suitePeriod.id}`;
      assert.equal((await send("put", url, input())).status, 404);
      assert.equal((await send("delete", url)).status, 404);
    });

    test("admin can manage any hotel", async () => {
      const res = await send("post", base(other), input(), adminCookie);
      assert.equal(res.status, 201);
    });
  });

  test("create → 201 with nights and price", async () => {
    const res = await send("post", base(mine), input());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const period = adminRatePeriodSchema.parse(res.body.data);
    assert.equal(period.name, "High season");
    assert.equal(period.startDate, "2027-06-10");
    assert.equal(period.endDate, "2027-06-15");
    assert.equal(period.nights, 5);
    assert.equal(period.price, 1500.5);
  });

  test("an empty name is stored as null", async () => {
    const res = await send("post", base(mine), input({ name: "  " }));
    assert.equal(res.status, 201);
    assert.equal(adminRatePeriodSchema.parse(res.body.data).name, null);
  });

  test("validation: end not after start, too long, price decimals → 400", async () => {
    const cases = [
      input({ endDate: "2027-06-10" }),
      input({ endDate: "2027-06-01" }),
      input({ startDate: "2027-01-01", endDate: "2028-01-03" }),
      input({ price: 10.005 }),
      input({ price: -1 }),
      input({ startDate: "June 10" }),
    ];
    for (const body of cases) {
      const res = await send("post", base(mine), body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, "VALIDATION_FAILED");
    }
  });

  test("overlap → 409 naming the period; adjacent periods and other room types are fine", async () => {
    await addRatePeriod(mine.roomTypes[0]!.id, "2027-06-10", "2027-06-15", 1500);

    const overlap = await send("post", base(mine), input({ startDate: "2027-06-14", endDate: "2027-06-20" }));
    assert.equal(overlap.status, 409);
    assert.equal(overlap.body.error.code, "CONFLICT");
    assert.match(overlap.body.error.message, /2027-06-10 to 2027-06-15/);

    const after = await send("post", base(mine), input({ startDate: "2027-06-15", endDate: "2027-06-20" }));
    assert.equal(after.status, 201);
    const before = await send("post", base(mine), input({ startDate: "2027-06-05", endDate: "2027-06-10" }));
    assert.equal(before.status, 201);
    const suite = await send("post", base(mine, 1), input());
    assert.equal(suite.status, 201);
  });

  test("concurrent overlapping creates → one 201, the rest 409", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        send("post", base(mine), input({ startDate: "2027-07-01", endDate: `2027-07-0${i + 3}` })),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409]);
  });

  test("edit: change dates and price (its own dates don't count as overlap); overlap → 409", async () => {
    const period = await addRatePeriod(mine.roomTypes[0]!.id, "2027-06-10", "2027-06-15", 1500);
    await addRatePeriod(mine.roomTypes[0]!.id, "2027-06-20", "2027-06-25", 1800);
    const url = `${base(mine)}/${period.id}`;

    const res = await send("put", url, input({ startDate: "2027-06-12", endDate: "2027-06-20", price: 1600 }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const updated = adminRatePeriodSchema.parse(res.body.data);
    assert.deepEqual([updated.startDate, updated.endDate, updated.nights, updated.price], [
      "2027-06-12",
      "2027-06-20",
      8,
      1600,
    ]);

    const clash = await send("put", url, input({ startDate: "2027-06-12", endDate: "2027-06-21" }));
    assert.equal(clash.status, 409);
  });

  test("list is ordered by start date", async () => {
    await addRatePeriod(mine.roomTypes[0]!.id, "2027-08-01", "2027-08-05", 1800);
    await addRatePeriod(mine.roomTypes[0]!.id, "2027-06-01", "2027-06-05", 1500);
    const res = await send("get", base(mine));
    assert.equal(res.status, 200);
    const list = adminRatePeriodListSchema.parse(res.body.data);
    assert.deepEqual(
      list.map((p) => p.startDate),
      ["2027-06-01", "2027-08-01"],
    );
  });

  test("delete → 204 and the room type becomes deletable again when it has no rooms", async () => {
    // A room type with no rooms: only the period blocks deleting it
    const created = await send(
      "post",
      `/api/admin/hotels/${mine.hotelId}/room-types`,
      { name: "Empty", capacity: 2, basePrice: 800, images: [], amenityIds: [] },
    );
    assert.equal(created.status, 201);
    const roomTypeId = adminRoomTypeSchema.parse(created.body.data).id;
    const roomTypeUrl = `/api/admin/hotels/${mine.hotelId}/room-types/${roomTypeId}`;

    const period = await send("post", `${roomTypeUrl}/rate-periods`, input());
    assert.equal(period.status, 201);
    const blocked = adminRoomTypeSchema.parse((await send("get", roomTypeUrl)).body.data);
    assert.equal(blocked.deletable, false);

    const del = await send("delete", `${roomTypeUrl}/rate-periods/${period.body.data.id}`);
    assert.equal(del.status, 204);
    const free = adminRoomTypeSchema.parse((await send("get", roomTypeUrl)).body.data);
    assert.equal(free.deletable, true);
    assert.equal((await send("delete", roomTypeUrl)).status, 204);
  });

  test("the public quote uses the new price", async () => {
    const res = await send("post", base(mine), input({ startDate: "2027-06-11", endDate: "2027-06-13", price: 2222 }));
    assert.equal(res.status, 201);
    const quote = await request(app)
      .get(`/api/hotels/${mine.slug}/availability`)
      .query({ checkIn: "2027-06-10", checkOut: "2027-06-14" });
    assert.equal(quote.status, 200, JSON.stringify(quote.body));
    const standard = availabilitySchema
      .parse(quote.body.data)
      .roomTypes.find((r) => r.roomTypeId === mine.roomTypes[0]!.id);
    assert.deepEqual(
      standard?.quote.nightly.map((n) => n.price),
      [1000, 2222, 2222, 1000],
    );
  });
});
