import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { adminAuditLogListSchema, type AdminAuditLog, type PublicUser } from "@booking/shared";
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

const LABEL = "admin-audit-logs";
const CODE_PREFIX = `test-audit-${process.pid}`;

describe("admin audit log API", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let staff: PublicUser;
  let admin: PublicUser;
  let staffCookie = "";
  let adminCookie = "";

  const list = async (query: string, cookie: string): Promise<AdminAuditLog[]> => {
    const res = await request(app).get(`/api/admin/audit-logs?pageSize=50&${query}`).set("Cookie", cookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return adminAuditLogListSchema.parse(res.body.data).items;
  };

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    mine = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    other = await createCatalogFixture(LABEL, { roomTypes: [] });
    staff = await createFixtureUser(LABEL, "STAFF");
    admin = await createFixtureUser(LABEL, "ADMIN");
    await assignStaff(staff.id, mine.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
  });

  after(async () => {
    await prisma.amenity.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("a hotel update records only the changed fields, with the actor and hotel", async () => {
    const res = await request(app)
      .patch(`/api/admin/hotels/${mine.hotelId}`)
      .set("Cookie", staffCookie)
      .send({ address: "2 Audit Road" });
    assert.equal(res.status, 200);

    const [row] = await list(`entityType=HOTEL&entityId=${mine.hotelId}`, adminCookie);
    assert.ok(row);
    assert.equal(row.action, "UPDATE");
    assert.equal(row.entityLabel, mine.name);
    assert.deepEqual(row.hotel, { id: mine.hotelId, name: mine.name });
    assert.deepEqual(row.actor, { id: staff.id, name: staff.name, role: "STAFF" });
    assert.deepEqual(row.changes, [{ field: "address", before: "1 Fixture Road", after: "2 Audit Road" }]);
  });

  test("an update that changes nothing records no row", async () => {
    const before = await list(`entityType=HOTEL&entityId=${mine.hotelId}`, adminCookie);
    const res = await request(app)
      .patch(`/api/admin/hotels/${mine.hotelId}`)
      .set("Cookie", adminCookie)
      .send({ name: mine.name });
    assert.equal(res.status, 200);
    const after = await list(`entityType=HOTEL&entityId=${mine.hotelId}`, adminCookie);
    assert.equal(after.length, before.length);
  });

  test("rooms record create and update under the hotel", async () => {
    const roomTypeId = mine.roomTypes[0]!.id;
    const base = `/api/admin/hotels/${mine.hotelId}/room-types/${roomTypeId}/rooms`;
    const created = await request(app).post(base).set("Cookie", staffCookie).send({ number: "A1" });
    assert.equal(created.status, 201);
    const room = (created.body.data.rooms as { id: string; number: string }[]).find((r) => r.number === "A1");
    assert.ok(room);
    const off = await request(app).patch(`${base}/${room.id}`).set("Cookie", staffCookie).send({ isActive: false });
    assert.equal(off.status, 200);

    const rows = await list(`entityType=ROOM&entityId=${room.id}`, adminCookie);
    assert.deepEqual(
      rows.map((r) => [r.action, r.changes]),
      [
        ["UPDATE", [{ field: "isActive", before: true, after: false }]],
        [
          "CREATE",
          [
            { field: "number", before: null, after: "A1" },
            { field: "isActive", before: null, after: true },
          ],
        ],
      ],
    );
    assert.ok(rows.every((r) => r.hotel?.id === mine.hotelId && r.entityLabel.endsWith("· A1")));
  });

  test("a room type's history includes its rooms and rate periods, deleted ones too", async () => {
    const roomTypeId = mine.roomTypes[0]!.id;
    const base = `/api/admin/hotels/${mine.hotelId}/room-types/${roomTypeId}`;
    const created = await request(app)
      .post(`${base}/rate-periods`)
      .set("Cookie", staffCookie)
      .send({ name: "Audit Peak", startDate: "2030-01-01", endDate: "2030-01-05", price: 2000 });
    assert.equal(created.status, 201);
    const ratePeriodId = created.body.data.id as string;
    const deleted = await request(app).delete(`${base}/rate-periods/${ratePeriodId}`).set("Cookie", staffCookie);
    assert.equal(deleted.status, 204);

    const rows = await list(`entityType=ROOM_TYPE&entityId=${roomTypeId}`, staffCookie);
    const periods = rows.filter((r) => r.entityId === ratePeriodId);
    assert.deepEqual(
      periods.map((r) => r.action),
      ["DELETE", "CREATE"],
    );
    assert.ok(rows.some((r) => r.entityType === "ROOM"));
    assert.ok(rows.every((r) => r.entityId === roomTypeId || r.entityType !== "ROOM_TYPE"));
  });

  test("an amenity delete records the last values; amenity rows are ADMIN only", async () => {
    const code = `${CODE_PREFIX}-wifi`;
    const created = await request(app)
      .post("/api/admin/amenities")
      .set("Cookie", adminCookie)
      .send({ code, name: "Audit Wifi", scope: "HOTEL" });
    assert.equal(created.status, 201);
    const id = created.body.data.id as string;
    const deleted = await request(app).delete(`/api/admin/amenities/${id}`).set("Cookie", adminCookie);
    assert.equal(deleted.status, 204);

    const rows = await list(`entityType=AMENITY&entityId=${id}`, adminCookie);
    assert.deepEqual(
      rows.map((r) => r.action),
      ["DELETE", "CREATE"],
    );
    assert.deepEqual(rows[0]!.changes, [
      { field: "code", before: code, after: null },
      { field: "name", before: "Audit Wifi", after: null },
      { field: "scope", before: "HOTEL", after: null },
    ]);
    assert.equal(rows[0]!.hotel, null);
    assert.deepEqual(await list(`entityType=AMENITY&entityId=${id}`, staffCookie), []);
  });

  test("staff see only their hotels' rows; another hotel's hotelId → 403", async () => {
    const res = await request(app)
      .patch(`/api/admin/hotels/${other.hotelId}`)
      .set("Cookie", adminCookie)
      .send({ address: "9 Elsewhere" });
    assert.equal(res.status, 200);

    const asAdmin = await list(`hotelId=${other.hotelId}`, adminCookie);
    assert.equal(asAdmin.length, 1);
    const asStaff = await list("", staffCookie);
    assert.ok(asStaff.length > 0);
    assert.ok(asStaff.every((r) => r.hotel?.id === mine.hotelId));

    const forbidden = await request(app)
      .get(`/api/admin/audit-logs?hotelId=${other.hotelId}`)
      .set("Cookie", staffCookie);
    assert.equal(forbidden.status, 403);
  });

  test("filters by action and rejects an unknown entity type", async () => {
    const creates = await list(`hotelId=${mine.hotelId}&action=CREATE`, adminCookie);
    assert.ok(creates.length > 0 && creates.every((r) => r.action === "CREATE"));
    const bad = await request(app).get("/api/admin/audit-logs?entityType=NOPE").set("Cookie", adminCookie);
    assert.equal(bad.status, 400);
  });
});
