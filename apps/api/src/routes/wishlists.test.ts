import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { WISHLIST_LIMIT, wishlistDetailSchema, wishlistListSchema, wishlistSummarySchema } from "@booking/shared";
import { app } from "../app";
import { prisma } from "../lib/prisma";
import {
  cleanupCatalogFixtures,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "wishlists";

describe("wishlists API", () => {
  let A: CatalogFixture;
  let B: CatalogFixture;
  let hidden: CatalogFixture;
  let me = "";
  let other = "";
  let adminCookie = "";

  const as = (cookie: string) => ({
    get: (path: string) => request(app).get(path).set("Cookie", cookie),
    post: (path: string, body: object) => request(app).post(path).set("Cookie", cookie).send(body),
    patch: (path: string, body: object) => request(app).patch(path).set("Cookie", cookie).send(body),
    put: (path: string) => request(app).put(path).set("Cookie", cookie),
    delete: (path: string) => request(app).delete(path).set("Cookie", cookie),
  });
  const createList = async (cookie: string, name: string) => {
    const res = await as(cookie).post("/api/wishlists", { name });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return wishlistSummarySchema.parse(res.body.data);
  };

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    A = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1200, rooms: 1 }] });
    B = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 800, rooms: 1 }] });
    hidden = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 500, rooms: 1 }] });
    await prisma.hotelImage.create({ data: { hotelId: B.hotelId, url: "https://img.test/b.jpg", alt: "B", sortOrder: 0 } });
    const user = await createFixtureUser(LABEL, "CUSTOMER");
    const someoneElse = await createFixtureUser(LABEL, "CUSTOMER");
    const admin = await createFixtureUser(LABEL, "ADMIN");
    me = `sid=${await signIn(user.id, "WEB")}`;
    other = `sid=${await signIn(someoneElse.id, "WEB")}`;
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("signed out (or with an admin cookie) → 401", async () => {
    assert.equal((await request(app).get("/api/wishlists")).status, 401);
    assert.equal((await as(adminCookie).get("/api/wishlists")).status, 401);
  });

  test("create, save hotels (idempotent), list newest first with cover, detail with fromPrice", async () => {
    const list = await createList(me, "  Chiang Mai trip ");
    assert.equal(list.name, "Chiang Mai trip");
    assert.deepEqual(list.hotelIds, []);
    assert.equal(list.coverImage, null);

    const base = `/api/wishlists/${list.id}/hotels`;
    assert.equal((await as(me).put(`${base}/${A.hotelId}`)).status, 204);
    assert.equal((await as(me).put(`${base}/${B.hotelId}`)).status, 204);
    assert.equal((await as(me).put(`${base}/${B.hotelId}`)).status, 204);

    const all = wishlistListSchema.parse((await as(me).get("/api/wishlists")).body.data);
    const saved = all.find((l) => l.id === list.id);
    assert.deepEqual(saved?.hotelIds, [B.hotelId, A.hotelId]);
    assert.deepEqual(saved?.coverImage, { url: "https://img.test/b.jpg", alt: "B" });

    const detail = wishlistDetailSchema.parse((await as(me).get(`/api/wishlists/${list.id}`)).body.data);
    assert.deepEqual(
      detail.hotels.map((h) => [h.id, h.fromPrice]),
      [
        [B.hotelId, 800],
        [A.hotelId, 1200],
      ],
    );

    assert.equal((await as(me).delete(`${base}/${A.hotelId}`)).status, 204);
    assert.equal((await as(me).delete(`${base}/${A.hotelId}`)).status, 204);
    const after = wishlistDetailSchema.parse((await as(me).get(`/api/wishlists/${list.id}`)).body.data);
    assert.deepEqual(after.hotels.map((h) => h.id), [B.hotelId]);
  });

  test("a deactivated hotel drops out of lists; unknown or inactive hotel can't be saved", async () => {
    const list = await createList(me, "Hidden check");
    await as(me).put(`/api/wishlists/${list.id}/hotels/${hidden.hotelId}`);
    await prisma.hotel.update({ where: { id: hidden.hotelId }, data: { isActive: false } });
    const detail = wishlistDetailSchema.parse((await as(me).get(`/api/wishlists/${list.id}`)).body.data);
    assert.deepEqual(detail.hotels, []);
    const all = wishlistListSchema.parse((await as(me).get("/api/wishlists")).body.data);
    assert.deepEqual(all.find((l) => l.id === list.id)?.hotelIds, []);

    const again = await as(me).put(`/api/wishlists/${list.id}/hotels/${hidden.hotelId}`);
    assert.equal(again.status, 404);
    assert.equal(again.body.error.message, "Hotel not found");
    assert.equal((await as(me).put(`/api/wishlists/${list.id}/hotels/nope`)).status, 404);
  });

  test("another user's list is a 404 for every action and stays untouched", async () => {
    const mine = await createList(me, "Private");
    await as(me).put(`/api/wishlists/${mine.id}/hotels/${A.hotelId}`);
    const o = as(other);
    const path = `/api/wishlists/${mine.id}`;
    for (const res of [
      await o.get(path),
      await o.patch(path, { name: "Stolen" }),
      await o.delete(path),
      await o.put(`${path}/hotels/${B.hotelId}`),
      await o.delete(`${path}/hotels/${A.hotelId}`),
    ]) {
      assert.equal(res.status, 404);
    }
    assert.ok(!wishlistListSchema.parse((await o.get("/api/wishlists")).body.data).some((l) => l.id === mine.id));
    const detail = wishlistDetailSchema.parse((await as(me).get(path)).body.data);
    assert.equal(detail.name, "Private");
    assert.deepEqual(detail.hotels.map((h) => h.id), [A.hotelId]);
  });

  test("rename; duplicate or blank names; delete removes the list and its items", async () => {
    const one = await createList(me, "Beach");
    await createList(me, "Mountains");
    const renamed = await as(me).patch(`/api/wishlists/${one.id}`, { name: "Beach 2027" });
    assert.equal(renamed.status, 200);
    assert.equal(wishlistSummarySchema.parse(renamed.body.data).name, "Beach 2027");

    const dupCreate = await as(me).post("/api/wishlists", { name: "Mountains" });
    assert.equal(dupCreate.status, 409);
    assert.deepEqual(dupCreate.body.error.details.fieldErrors.name, ["A list with this name already exists"]);
    assert.equal((await as(me).patch(`/api/wishlists/${one.id}`, { name: "Mountains" })).status, 409);
    // Another user can reuse the name
    await createList(other, "Mountains");
    assert.equal((await as(me).post("/api/wishlists", { name: "  " })).status, 400);
    assert.equal((await as(me).post("/api/wishlists", { name: "x".repeat(51) })).status, 400);

    await as(me).put(`/api/wishlists/${one.id}/hotels/${A.hotelId}`);
    assert.equal((await as(me).delete(`/api/wishlists/${one.id}`)).status, 204);
    assert.equal((await as(me).get(`/api/wishlists/${one.id}`)).status, 404);
    assert.equal(await prisma.wishlistItem.count({ where: { wishlistId: one.id } }), 0);
  });

  test(`at most ${WISHLIST_LIMIT} lists per user → 409`, async () => {
    const existing = wishlistListSchema.parse((await as(other).get("/api/wishlists")).body.data).length;
    for (let i = existing; i < WISHLIST_LIMIT; i++) await createList(other, `List ${i}`);
    const over = await as(other).post("/api/wishlists", { name: "One too many" });
    assert.equal(over.status, 409);
    assert.equal(over.body.error.code, "CONFLICT");
  });
});
