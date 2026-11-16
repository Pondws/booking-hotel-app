import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import {
  SUPPORT_OPEN_LIMIT,
  adminSupportRequestListSchema,
  adminSupportRequestSchema,
  supportRequestListSchema,
  supportRequestSchema,
  type PublicUser,
} from "@booking/shared";
import { app } from "../app";
import { prisma } from "../lib/prisma";
import {
  addBooking,
  assignStaff,
  cleanupCatalogFixtures,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "support";

describe("support requests", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let code = "";
  let otherCode = "";
  let webCookie = "";
  let strangerCookie = "";
  let staffCookie = "";
  let staff: PublicUser;

  const message = { topic: "SPECIAL_REQUEST", message: "Could we get a late check-out please?" };
  const post = (c: string, body: object = message, cookie = webCookie) =>
    request(app).post(`/api/bookings/${c}/support-requests`).set("Cookie", cookie).send(body);

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    mine = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    other = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    code = (await addBooking(mine, mine.roomTypes[0]!.roomIds[0]!, "2030-01-10", "2030-01-12", "CONFIRMED")).code;
    otherCode = (await addBooking(other, other.roomTypes[0]!.roomIds[0]!, "2030-01-10", "2030-01-12", "CONFIRMED"))
      .code;
    webCookie = `sid=${await signIn(mine.userId, "WEB")}`;
    strangerCookie = `sid=${await signIn(other.userId, "WEB")}`;
    staff = await createFixtureUser(LABEL, "STAFF");
    await assignStaff(staff.id, mine.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
  });
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });
  beforeEach(() => prisma.supportRequest.deleteMany({ where: { booking: { code: { in: [code, otherCode] } } } }));

  test("customer creates and lists requests on their own booking", async () => {
    const res = await post(code);
    assert.equal(res.status, 201);
    const created = supportRequestSchema.parse(res.body.data);
    assert.equal(created.status, "OPEN");
    const row = await prisma.supportRequest.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.hotelId, mine.hotelId);
    assert.equal(row.userId, mine.userId);

    const list = await request(app).get(`/api/bookings/${code}/support-requests`).set("Cookie", webCookie);
    assert.equal(supportRequestListSchema.parse(list.body.data).length, 1);
  });

  test("another customer's booking is a 404", async () => {
    assert.equal((await post(code, message, strangerCookie)).status, 404);
    const list = await request(app).get(`/api/bookings/${code}/support-requests`).set("Cookie", strangerCookie);
    assert.equal(list.status, 404);
  });

  test("validation and the open-request cap", async () => {
    assert.equal((await post(code, { topic: "OTHER", message: "short" })).status, 400);
    for (let i = 0; i < SUPPORT_OPEN_LIMIT; i++) assert.equal((await post(code)).status, 201);
    assert.equal((await post(code)).status, 409);
  });

  test("staff see only their hotels' requests and resolve once", async () => {
    const created = supportRequestSchema.parse((await post(code)).body.data);
    await post(otherCode, message, strangerCookie);

    const list = await request(app).get("/api/admin/support-requests").set("Cookie", staffCookie);
    assert.equal(list.status, 200);
    const items = adminSupportRequestListSchema.parse(list.body.data).items;
    assert.ok(items.every((r) => r.hotel.id === mine.hotelId));
    assert.ok(items.some((r) => r.id === created.id));

    const reply = { reply: "Sure — late check-out until 14:00 is arranged." };
    const url = `/api/admin/support-requests/${created.id}/resolve`;
    const res = await request(app).post(url).set("Cookie", staffCookie).send(reply);
    assert.equal(res.status, 200);
    const resolved = adminSupportRequestSchema.parse(res.body.data);
    assert.equal(resolved.status, "RESOLVED");
    assert.equal(resolved.resolvedBy?.name, staff.name);

    assert.equal((await request(app).post(url).set("Cookie", staffCookie).send(reply)).status, 409);

    const otherRow = await prisma.supportRequest.findFirstOrThrow({ where: { booking: { code: otherCode } } });
    const foreign = await request(app)
      .post(`/api/admin/support-requests/${otherRow.id}/resolve`)
      .set("Cookie", staffCookie)
      .send(reply);
    assert.equal(foreign.status, 404);

    const seen = await request(app).get(`/api/bookings/${code}/support-requests`).set("Cookie", webCookie);
    assert.equal(supportRequestListSchema.parse(seen.body.data)[0]?.reply, reply.reply);
  });
});
