import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { adminHotelListSchema, adminHotelSchema, type PublicUser } from "@booking/shared";
import { app } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  assignStaff,
  cleanupCatalogFixtures,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../../test/catalog-fixtures";

const LABEL = "admin-hotels";

describe("admin hotels read API", () => {
  let h1: CatalogFixture;
  let h2: CatalogFixture;
  let h3: CatalogFixture;
  let staff: PublicUser;
  let admin: PublicUser;
  let staffCookie = "";
  let adminCookie = "";
  let webCookie = "";

  const get = (path: string, cookie?: string) => {
    const req = request(app).get(path);
    return cookie ? req.set("Cookie", cookie) : req;
  };

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    const city = `AdminHotelsCity ${Date.now()}`;
    h1 = await createCatalogFixture(LABEL, { city, roomTypes: [] });
    h2 = await createCatalogFixture(LABEL, { city, isActive: false, roomTypes: [] });
    h3 = await createCatalogFixture(LABEL, { roomTypes: [] });
    staff = await createFixtureUser(LABEL, "STAFF");
    admin = await createFixtureUser(LABEL, "ADMIN");
    await assignStaff(staff.id, h1.hotelId);
    await assignStaff(staff.id, h2.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
    webCookie = `sid=${await signIn(staff.id, "WEB")}`;
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  describe("GET /api/admin/hotels", () => {
    test("list as staff only returns assigned hotels", async () => {
      const res = await get("/api/admin/hotels?pageSize=50", staffCookie);
      assert.equal(res.status, 200);
      const { items } = adminHotelListSchema.parse(res.body.data);
      const ids = items.map((i) => i.id);
      assert.ok(ids.includes(h1.hotelId) && ids.includes(h2.hotelId));
      assert.ok(!ids.includes(h3.hotelId));
      for (const id of ids) assert.ok([h1.hotelId, h2.hotelId].includes(id));
    });

    test("list as admin filters by q, status and paginates", async () => {
      const q = encodeURIComponent(h1.city);
      const all = await get(`/api/admin/hotels?q=${q}`, adminCookie);
      assert.equal(all.status, 200);
      const allIds = adminHotelListSchema.parse(all.body.data).items.map((i) => i.id).sort();
      assert.deepEqual(allIds, [h1.hotelId, h2.hotelId].sort());

      const active = await get(`/api/admin/hotels?q=${q}&status=active`, adminCookie);
      assert.deepEqual(
        adminHotelListSchema.parse(active.body.data).items.map((i) => i.id),
        [h1.hotelId],
      );
      const inactive = await get(`/api/admin/hotels?q=${q}&status=inactive`, adminCookie);
      assert.deepEqual(
        adminHotelListSchema.parse(inactive.body.data).items.map((i) => i.id),
        [h2.hotelId],
      );

      const paged = adminHotelListSchema.parse(
        (await get(`/api/admin/hotels?q=${q}&pageSize=1`, adminCookie)).body.data,
      );
      assert.equal(paged.items.length, 1);
      assert.equal(paged.total, 2);
    });
  });

  describe("GET /api/admin/hotels/:hotelId", () => {
    test("assigned staff gets the hotel", async () => {
      const res = await get(`/api/admin/hotels/${h1.hotelId}`, staffCookie);
      assert.equal(res.status, 200);
      const hotel = adminHotelSchema.parse(res.body.data);
      assert.equal(hotel.checkInTime, "14:00");
      assert.equal(hotel.isActive, true);
      const inactive = adminHotelSchema.parse(
        (await get(`/api/admin/hotels/${h2.hotelId}`, staffCookie)).body.data,
      );
      assert.equal(inactive.isActive, false);
    });

    test("unassigned or unknown hotel as staff → 403", async () => {
      const res = await get(`/api/admin/hotels/${h3.hotelId}`, staffCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.error.message, "No access to this hotel");
      assert.equal((await get("/api/admin/hotels/does-not-exist", staffCookie)).status, 403);
    });

    test("unknown hotel as admin → 404", async () => {
      const res = await get("/api/admin/hotels/does-not-exist", adminCookie);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, "NOT_FOUND");
    });

    test("web session cookie → 401", async () => {
      const res = await get(`/api/admin/hotels/${h1.hotelId}`, webCookie);
      assert.equal(res.status, 401);
    });
  });

  describe("GET /api/admin/amenities", () => {
    test("filters by scope", async () => {
      const res = await get("/api/admin/amenities?scope=HOTEL", staffCookie);
      assert.equal(res.status, 200);
      const items = res.body.data as { code: string; scope: string }[];
      assert.ok(items.length > 0);
      assert.ok(items.every((a) => a.scope === "HOTEL"));
      assert.ok(items.some((a) => a.code === "wifi"));
      assert.ok(!items.some((a) => a.code === "aircon"));
    });

    test("without scope returns both", async () => {
      const res = await get("/api/admin/amenities", staffCookie);
      const codes = (res.body.data as { code: string }[]).map((a) => a.code);
      assert.ok(codes.includes("wifi") && codes.includes("aircon"));
    });
  });

  describe("writes", () => {
    let w: CatalogFixture;
    const A = "https://example.com/a.jpg";
    const B = "https://example.com/b.jpg";
    const send = (method: "patch" | "put", path: string, body: unknown, cookie = staffCookie) =>
      request(app)[method](path).set("Cookie", cookie).send(body as object);
    const amenityId = async (code: string) =>
      (await prisma.amenity.findUniqueOrThrow({ where: { code } })).id;
    const publicGet = (slug: string) => request(app).get(`/api/hotels/${slug}`);

    before(async () => {
      w = await createCatalogFixture(LABEL, { roomTypes: [] });
      await assignStaff(staff.id, w.hotelId);
    });

    test("PATCH updates fields, keeps slug, hotel stays public", async () => {
      const res = await send("patch", `/api/admin/hotels/${w.hotelId}`, {
        name: `Cat Test ${LABEL} Renamed`,
        checkInTime: "15:00",
      });
      assert.equal(res.status, 200);
      const hotel = adminHotelSchema.parse(res.body.data);
      assert.equal(hotel.name, `Cat Test ${LABEL} Renamed`);
      assert.equal(hotel.checkInTime, "15:00");
      assert.equal(hotel.slug, w.slug);
      assert.equal((await publicGet(w.slug)).status, 200);
    });

    test("PATCH empty description → null; empty body and bad time → 400", async () => {
      const url = `/api/admin/hotels/${w.hotelId}`;
      const cleared = await send("patch", url, { description: "" });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.data.description, null);
      assert.equal((await send("patch", url, {})).status, 400);
      const bad = await send("patch", url, { checkOutTime: "25:00" });
      assert.equal(bad.status, 400);
      assert.ok(bad.body.error.details.fieldErrors.checkOutTime);
    });

    test("PATCH unassigned hotel as staff → 403", async () => {
      const res = await send("patch", `/api/admin/hotels/${h3.hotelId}`, { city: "Nope" });
      assert.equal(res.status, 403);
    });

    test("PUT images replaces, orders and clears", async () => {
      const url = `/api/admin/hotels/${w.hotelId}/images`;
      const both = await send("put", url, { images: [{ url: B }, { url: A, alt: "A" }] });
      assert.equal(both.status, 200);
      const images = adminHotelSchema.parse(both.body.data).images;
      assert.deepEqual(images.map((i) => i.url), [B, A]);
      assert.deepEqual(images.map((i) => i.sortOrder), [0, 1]);
      assert.equal(images[0]?.alt, null);
      assert.equal(images[1]?.alt, "A");

      const one = await send("put", url, { images: [{ url: A }] });
      assert.deepEqual(adminHotelSchema.parse(one.body.data).images.map((i) => i.url), [A]);
      const none = await send("put", url, { images: [] });
      assert.equal(none.status, 200);
      assert.deepEqual(none.body.data.images, []);
    });

    test("PUT images rejects duplicates and more than 20", async () => {
      const url = `/api/admin/hotels/${w.hotelId}/images`;
      assert.equal((await send("put", url, { images: [{ url: A }, { url: A }] })).status, 400);
      const many = Array.from({ length: 21 }, (_, i) => ({ url: `https://example.com/${i}.jpg` }));
      assert.equal((await send("put", url, { images: many })).status, 400);
    });

    test("PUT images on an unassigned hotel as staff → 403, nothing changed", async () => {
      const before = await prisma.hotelImage.count({ where: { hotelId: h3.hotelId } });
      const res = await send("put", `/api/admin/hotels/${h3.hotelId}/images`, {
        images: [{ url: A }],
      });
      assert.equal(res.status, 403);
      assert.equal(await prisma.hotelImage.count({ where: { hotelId: h3.hotelId } }), before);
    });

    test("PUT amenities replaces; room amenities and unknown ids → 400, unchanged", async () => {
      const url = `/api/admin/hotels/${w.hotelId}/amenities`;
      const wifi = await amenityId("wifi");
      const pool = await amenityId("pool");
      const aircon = await amenityId("aircon");
      const res = await send("put", url, { amenityIds: [wifi, pool] });
      assert.equal(res.status, 200);
      const codes = adminHotelSchema.parse(res.body.data).amenities.map((a) => a.code);
      assert.deepEqual(new Set(codes), new Set(["wifi", "pool"]));

      const room = await send("put", url, { amenityIds: [wifi, aircon] });
      assert.equal(room.status, 400);
      assert.ok(room.body.error.details.fieldErrors.amenityIds);
      const unknown = await send("put", url, { amenityIds: ["does-not-exist"] });
      assert.equal(unknown.status, 400);

      const detail = await get(`/api/admin/hotels/${w.hotelId}`, staffCookie);
      const after = adminHotelSchema.parse(detail.body.data).amenities.map((a) => a.code);
      assert.deepEqual(new Set(after), new Set(["wifi", "pool"]));
    });

    test("PATCH status: staff → 403; admin toggles public visibility", async () => {
      const url = `/api/admin/hotels/${w.hotelId}/status`;
      assert.equal((await send("patch", url, { isActive: false })).status, 403);
      const off = await send("patch", url, { isActive: false }, adminCookie);
      assert.equal(off.status, 200);
      assert.equal(off.body.data.isActive, false);
      assert.equal((await publicGet(w.slug)).status, 404);
      const on = await send("patch", url, { isActive: true }, adminCookie);
      assert.equal(on.body.data.isActive, true);
      assert.equal((await publicGet(w.slug)).status, 200);
    });
  });
});
