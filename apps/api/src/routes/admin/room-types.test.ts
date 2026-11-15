import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import {
  adminRoomTypeListSchema,
  adminRoomTypeSchema,
  hotelDetailSchema,
  type PublicUser,
  type RoomTypeInput,
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

const LABEL = "admin-room-types";

describe("admin room types + rooms API", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let staff: PublicUser;
  let staffCookie = "";
  let adminCookie = "";
  let webCookie = "";

  const amenityId = async (code: string) =>
    (await prisma.amenity.findUniqueOrThrow({ where: { code } })).id;

  type Method = "get" | "post" | "put" | "patch" | "delete";
  const send = (method: Method, path: string, body?: object, cookie = staffCookie) => {
    const req = request(app)[method](path).set("Cookie", cookie);
    return body === undefined ? req : req.send(body);
  };

  const input = (overrides: Partial<RoomTypeInput> = {}): RoomTypeInput => ({
    name: "Deluxe King",
    description: "City view",
    capacity: 2,
    basePrice: 2500.5,
    images: [],
    amenityIds: [],
    ...overrides,
  });

  const base = (fx: CatalogFixture) => `/api/admin/hotels/${fx.hotelId}/room-types`;

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    mine = await createCatalogFixture(LABEL, {
      roomTypes: [
        { name: "Standard", capacity: 2, basePrice: 1000, rooms: 2, inactiveRooms: 1 },
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

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  describe("access", () => {
    test("staff on an unassigned hotel → 403 for every endpoint", async () => {
      const rt = other.roomTypes[0]!;
      const url = base(other);
      const calls = [
        send("get", url),
        send("post", url, input()),
        send("get", `${url}/${rt.id}`),
        send("put", `${url}/${rt.id}`, input()),
        send("patch", `${url}/${rt.id}/status`, { isActive: false }),
        send("delete", `${url}/${rt.id}`),
        send("post", `${url}/${rt.id}/rooms`, { number: "999" }),
        send("patch", `${url}/${rt.id}/rooms/${rt.roomIds[0]}`, { isActive: false }),
      ];
      for (const res of await Promise.all(calls)) assert.equal(res.status, 403);
    });

    test("web session → 401", async () => {
      assert.equal((await send("get", base(mine), undefined, webCookie)).status, 401);
    });

    test("a room type of another hotel through my hotel's URL → 404", async () => {
      const foreign = other.roomTypes[0]!;
      const url = `${base(mine)}/${foreign.id}`;
      assert.equal((await send("get", url)).status, 404);
      assert.equal((await send("put", url, input())).status, 404);
      assert.equal((await send("patch", `${url}/status`, { isActive: false })).status, 404);
      assert.equal((await send("post", `${url}/rooms`, { number: "X1" })).status, 404);
      const room = await send("patch", `${base(mine)}/${mine.roomTypes[0]!.id}/rooms/${foreign.roomIds[0]}`, {
        isActive: false,
      });
      assert.equal(room.status, 404);
    });

    test("admin, unknown hotel → 404", async () => {
      const res = await send("get", "/api/admin/hotels/does-not-exist/room-types", undefined, adminCookie);
      assert.equal(res.status, 404);
    });
  });

  test("list returns room counts ordered by name", async () => {
    const res = await send("get", base(mine));
    assert.equal(res.status, 200);
    const list = adminRoomTypeListSchema.parse(res.body.data);
    assert.deepEqual(
      list.map((rt) => [rt.name, rt.roomCount, rt.activeRoomCount, rt.basePrice]),
      [
        ["Standard", 3, 2, 1000],
        ["Suite", 1, 1, 5000],
      ],
    );
  });

  test("detail includes rooms by number and deletable = false with rooms", async () => {
    const res = await send("get", `${base(mine)}/${mine.roomTypes[0]!.id}`);
    assert.equal(res.status, 200);
    const rt = adminRoomTypeSchema.parse(res.body.data);
    assert.equal(rt.hotel.id, mine.hotelId);
    assert.deepEqual(
      rt.rooms.map((r) => [r.number, r.isActive]),
      [
        ["101", true],
        ["102", true],
        ["103", false],
      ],
    );
    assert.equal(rt.deletable, false);
  });

  describe("create + save", () => {
    test("create with images and room amenities → 201, then save replaces everything", async () => {
      const aircon = await amenityId("aircon");
      const created = await send(
        "post",
        base(mine),
        input({
          images: [{ url: "https://example.com/a.jpg", alt: "Bed" }, { url: "https://example.com/b.jpg" }],
          amenityIds: [aircon],
        }),
      );
      assert.equal(created.status, 201);
      const rt = adminRoomTypeSchema.parse(created.body.data);
      assert.equal(rt.basePrice, 2500.5);
      assert.equal(rt.isActive, true);
      assert.equal(rt.deletable, true);
      assert.deepEqual(rt.images.map((i) => [i.url, i.alt]), [
        ["https://example.com/a.jpg", "Bed"],
        ["https://example.com/b.jpg", null],
      ]);
      assert.deepEqual(rt.amenities.map((a) => a.id), [aircon]);

      const saved = await send(
        "put",
        `${base(mine)}/${rt.id}`,
        input({
          name: "Deluxe Twin",
          description: "",
          capacity: 3,
          basePrice: 1999.99,
          images: [{ url: "https://example.com/b.jpg" }],
          amenityIds: [],
        }),
      );
      assert.equal(saved.status, 200);
      const after = adminRoomTypeSchema.parse(saved.body.data);
      assert.equal(after.name, "Deluxe Twin");
      assert.equal(after.description, null);
      assert.equal(after.capacity, 3);
      assert.equal(after.basePrice, 1999.99);
      assert.deepEqual(after.images.map((i) => i.url), ["https://example.com/b.jpg"]);
      assert.deepEqual(after.amenities, []);
    });

    test("a HOTEL amenity → 400 on amenityIds and nothing is saved", async () => {
      const rtId = mine.roomTypes[1]!.id;
      const wifi = await amenityId("wifi");
      const res = await send("put", `${base(mine)}/${rtId}`, input({ name: "Changed", amenityIds: [wifi] }));
      assert.equal(res.status, 400);
      assert.ok(res.body.error.details.fieldErrors.amenityIds);
      const row = await prisma.roomType.findUniqueOrThrow({ where: { id: rtId } });
      assert.equal(row.name, "Suite");
    });

    test("invalid capacity / price → 400 with fieldErrors", async () => {
      const bad = [
        input({ capacity: 0 }),
        input({ capacity: 2.5 }),
        input({ basePrice: -1 }),
        input({ basePrice: 10.123 }),
        input({ name: "  " }),
      ];
      for (const body of bad) {
        const res = await send("post", base(mine), body);
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.error.code, "VALIDATION_FAILED");
      }
    });
  });

  test("deactivating hides the room type from the public hotel page; reactivating restores it", async () => {
    const rtId = mine.roomTypes[1]!.id;
    const publicTypes = async () =>
      hotelDetailSchema.parse((await request(app).get(`/api/hotels/${mine.slug}`)).body.data).roomTypes.map(
        (rt) => rt.id,
      );
    const off = await send("patch", `${base(mine)}/${rtId}/status`, { isActive: false });
    assert.equal(off.status, 200);
    assert.equal(adminRoomTypeSchema.parse(off.body.data).isActive, false);
    assert.ok(!(await publicTypes()).includes(rtId));
    await send("patch", `${base(mine)}/${rtId}/status`, { isActive: true });
    assert.ok((await publicTypes()).includes(rtId));
  });

  describe("delete", () => {
    test("an empty room type → 204", async () => {
      const created = adminRoomTypeSchema.parse((await send("post", base(mine), input({ name: "Temp" }))).body.data);
      const res = await send("delete", `${base(mine)}/${created.id}`);
      assert.equal(res.status, 204);
      assert.equal(await prisma.roomType.count({ where: { id: created.id } }), 0);
    });

    test("with rooms or rate periods → 409", async () => {
      const withRooms = await send("delete", `${base(mine)}/${mine.roomTypes[0]!.id}`);
      assert.equal(withRooms.status, 409);
      assert.equal(withRooms.body.error.code, "CONFLICT");

      const created = adminRoomTypeSchema.parse((await send("post", base(mine), input({ name: "Rated" }))).body.data);
      await addRatePeriod(created.id, "2030-01-01", "2030-01-10", 3000);
      const detail = adminRoomTypeSchema.parse((await send("get", `${base(mine)}/${created.id}`)).body.data);
      assert.equal(detail.deletable, false);
      assert.equal((await send("delete", `${base(mine)}/${created.id}`)).status, 409);
    });
  });

  describe("rooms", () => {
    test("add, rename and deactivate", async () => {
      const url = `${base(mine)}/${mine.roomTypes[1]!.id}/rooms`;
      const added = await send("post", url, { number: " 2A " });
      assert.equal(added.status, 201);
      const room = adminRoomTypeSchema.parse(added.body.data).rooms.find((r) => r.number === "2A");
      assert.ok(room);

      const renamed = await send("patch", `${url}/${room.id}`, { number: "2B" });
      assert.equal(renamed.status, 200);
      const rooms = adminRoomTypeSchema.parse(renamed.body.data).rooms;
      assert.ok(rooms.some((r) => r.id === room.id && r.number === "2B" && r.isActive));

      const off = await send("patch", `${url}/${room.id}`, { isActive: false });
      assert.ok(adminRoomTypeSchema.parse(off.body.data).rooms.some((r) => r.id === room.id && !r.isActive));
    });

    test("a number already used in the same hotel (other room type) → 409", async () => {
      const suiteRooms = `${base(mine)}/${mine.roomTypes[1]!.id}/rooms`;
      const dup = await send("post", suiteRooms, { number: "101" });
      assert.equal(dup.status, 409);
      assert.match(dup.body.error.message, /Room 101 already exists/);

      const suiteRoom = mine.roomTypes[1]!.roomIds[0]!;
      const rename = await send("patch", `${suiteRooms}/${suiteRoom}`, { number: "102" });
      assert.equal(rename.status, 409);

      // The same number in another hotel is fine
      const otherHotel = await send(
        "post",
        `${base(other)}/${other.roomTypes[0]!.id}/rooms`,
        { number: "101-X" },
        adminCookie,
      );
      assert.equal(otherHotel.status, 201);
    });

    test("invalid number or empty patch → 400", async () => {
      const url = `${base(mine)}/${mine.roomTypes[1]!.id}/rooms`;
      assert.equal((await send("post", url, { number: "1 01" })).status, 400);
      assert.equal((await send("post", url, { number: "" })).status, 400);
      assert.equal((await send("patch", `${url}/${mine.roomTypes[1]!.roomIds[0]}`, {})).status, 400);
    });
  });
});
