import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { adminAmenityListSchema, adminAmenitySchema, type PublicUser } from "@booking/shared";
import { app } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  cleanupCatalogFixtures,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../../test/catalog-fixtures";

const LABEL = "admin-amenities";
/** Every amenity this file creates starts with this code, so `after()` removes exactly those. */
const CODE_PREFIX = `test-amenities-${process.pid}`;
let seq = 0;
const newCode = () => `${CODE_PREFIX}-${Date.now()}-${++seq}`;

describe("admin amenities API", () => {
  let hotel: CatalogFixture;
  let staff: PublicUser;
  let admin: PublicUser;
  let adminCookie = "";
  let staffCookie = "";

  const as = (cookie: string) => ({
    get: (path: string) => request(app).get(path).set("Cookie", cookie),
    post: (path: string, body: object) => request(app).post(path).set("Cookie", cookie).send(body),
    patch: (path: string, body: object) => request(app).patch(path).set("Cookie", cookie).send(body),
    delete: (path: string) => request(app).delete(path).set("Cookie", cookie),
  });

  const create = async (body: { code: string; name: string; scope: "HOTEL" | "ROOM" }) => {
    const res = await as(adminCookie).post("/api/admin/amenities", body);
    assert.equal(res.status, 201);
    return adminAmenitySchema.parse(res.body.data);
  };

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    hotel = await createCatalogFixture(LABEL, { roomTypes: [] });
    staff = await createFixtureUser(LABEL, "STAFF");
    admin = await createFixtureUser(LABEL, "ADMIN");
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
  });

  after(async () => {
    await prisma.amenity.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("STAFF can list (with counts) but every write → 403", async () => {
    const list = await as(staffCookie).get("/api/admin/amenities");
    assert.equal(list.status, 200);
    const items = adminAmenityListSchema.parse(list.body.data);
    assert.ok(items.some((a) => a.code === "wifi" && a.hotelCount >= 1));

    const wifi = items.find((a) => a.code === "wifi");
    assert.ok(wifi);
    const s = as(staffCookie);
    assert.equal((await s.post("/api/admin/amenities", { code: newCode(), name: "x", scope: "HOTEL" })).status, 403);
    assert.equal((await s.patch(`/api/admin/amenities/${wifi.id}`, { code: "wifi", name: "x" })).status, 403);
    assert.equal((await s.delete(`/api/admin/amenities/${wifi.id}`)).status, 403);
  });

  test("create → 201; duplicate code → 409 on the field; invalid code → 400", async () => {
    const code = newCode();
    const created = await create({ code, name: " Rooftop bar ", scope: "HOTEL" });
    assert.equal(created.name, "Rooftop bar");
    assert.equal(created.scope, "HOTEL");
    assert.equal(created.hotelCount, 0);
    assert.equal(created.roomTypeCount, 0);

    const dup = await as(adminCookie).post("/api/admin/amenities", { code, name: "Again", scope: "ROOM" });
    assert.equal(dup.status, 409);
    assert.deepEqual(dup.body.error.details.fieldErrors.code, [`The code "${code}" is already used`]);

    for (const bad of ["Has Space", "UPPER", "-lead", "a--b", ""]) {
      const res = await as(adminCookie).post("/api/admin/amenities", { code: bad, name: "x", scope: "HOTEL" });
      assert.equal(res.status, 400, bad);
    }
  });

  test("edit code and name; scope is ignored; unknown → 404; code taken → 409", async () => {
    const a = await create({ code: newCode(), name: "Gym", scope: "HOTEL" });
    const b = await create({ code: newCode(), name: "Spa", scope: "HOTEL" });
    const code = newCode();
    const res = await as(adminCookie).patch(`/api/admin/amenities/${a.id}`, {
      code,
      name: "Fitness",
      scope: "ROOM",
    });
    assert.equal(res.status, 200);
    const updated = adminAmenitySchema.parse(res.body.data);
    assert.equal(updated.code, code);
    assert.equal(updated.name, "Fitness");
    assert.equal(updated.scope, "HOTEL");

    const taken = await as(adminCookie).patch(`/api/admin/amenities/${a.id}`, { code: b.code, name: "x" });
    assert.equal(taken.status, 409);
    const unknown = await as(adminCookie).patch("/api/admin/amenities/does-not-exist", {
      code: newCode(),
      name: "x",
    });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error.message, "Amenity not found");
  });

  test("get one → 200 with counts (ADMIN only); unknown → 404", async () => {
    const created = await create({ code: newCode(), name: "Sauna", scope: "ROOM" });
    const res = await as(adminCookie).get(`/api/admin/amenities/${created.id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(adminAmenitySchema.parse(res.body.data), created);
    assert.equal((await as(staffCookie).get(`/api/admin/amenities/${created.id}`)).status, 403);
    assert.equal((await as(adminCookie).get("/api/admin/amenities/does-not-exist")).status, 404);
  });

  test("list counts usage; delete → 204 removes the hotel link; again → 404", async () => {
    const a = await create({ code: newCode(), name: "Shuttle", scope: "HOTEL" });
    await prisma.hotelAmenity.create({ data: { hotelId: hotel.hotelId, amenityId: a.id } });

    const items = adminAmenityListSchema.parse(
      (await as(adminCookie).get("/api/admin/amenities?scope=HOTEL")).body.data,
    );
    assert.equal(items.find((i) => i.id === a.id)?.hotelCount, 1);

    assert.equal((await as(adminCookie).delete(`/api/admin/amenities/${a.id}`)).status, 204);
    assert.equal(await prisma.hotelAmenity.count({ where: { amenityId: a.id } }), 0);
    assert.equal((await as(adminCookie).delete(`/api/admin/amenities/${a.id}`)).status, 404);
  });
});
