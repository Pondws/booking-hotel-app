import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { adminStaffListSchema, adminStaffSchema, type PublicUser } from "@booking/shared";
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

const LABEL = "admin-staff";
let seq = 0;
/** Matches the fixture user prefix, so `cleanupCatalogFixtures(LABEL)` removes API-created staff too. */
const newEmail = () => `cat-test+${LABEL}-api-${Date.now()}-${++seq}@test.local`;

describe("admin staff API", () => {
  let h1: CatalogFixture;
  let h2: CatalogFixture;
  let staff: PublicUser;
  let admin: PublicUser;
  let customer: PublicUser;
  let adminCookie = "";
  let staffCookie = "";
  let webAdminCookie = "";

  const as = (cookie: string) => ({
    get: (path: string) => request(app).get(path).set("Cookie", cookie),
    post: (path: string, body?: object) => request(app).post(path).set("Cookie", cookie).send(body),
    patch: (path: string, body: object) => request(app).patch(path).set("Cookie", cookie).send(body),
    delete: (path: string) => request(app).delete(path).set("Cookie", cookie),
  });

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    h1 = await createCatalogFixture(LABEL, { roomTypes: [] });
    h2 = await createCatalogFixture(LABEL, { isActive: false, roomTypes: [] });
    staff = await createFixtureUser(LABEL, "STAFF");
    admin = await createFixtureUser(LABEL, "ADMIN");
    customer = await createFixtureUser(LABEL, "CUSTOMER");
    await assignStaff(staff.id, h1.hotelId);
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    webAdminCookie = `sid=${await signIn(admin.id, "WEB")}`;
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("STAFF caller → 403 on every route; web session → 401", async () => {
    const s = as(staffCookie);
    const forbidden = [
      await s.get("/api/admin/staff"),
      await s.get(`/api/admin/staff/${staff.id}`),
      await s.post("/api/admin/staff", { name: "x", email: newEmail(), password: "password123" }),
      await s.patch(`/api/admin/staff/${staff.id}`, { name: "x", phone: null }),
      await s.post(`/api/admin/staff/${staff.id}/hotels`, { hotelId: h2.hotelId }),
      await s.delete(`/api/admin/staff/${staff.id}/hotels/${h1.hotelId}`),
    ];
    for (const res of forbidden) assert.equal(res.status, 403);
    assert.equal((await as(webAdminCookie).get("/api/admin/staff")).status, 401);
  });

  test("list returns only STAFF users and searches name/email", async () => {
    const res = await as(adminCookie).get(`/api/admin/staff?q=${encodeURIComponent(staff.email)}`);
    assert.equal(res.status, 200);
    const list = adminStaffListSchema.parse(res.body.data);
    assert.deepEqual(
      list.items.map((i) => i.id),
      [staff.id],
    );
    assert.deepEqual(list.items[0]?.hotels.map((h) => h.id), [h1.hotelId]);

    const byPrefix = adminStaffListSchema.parse(
      (await as(adminCookie).get(`/api/admin/staff?q=cat-test%2B${LABEL}-&pageSize=50`)).body.data,
    );
    const ids = byPrefix.items.map((i) => i.id);
    assert.ok(ids.includes(staff.id));
    assert.ok(!ids.includes(admin.id) && !ids.includes(customer.id));
  });

  test("detail of an ADMIN / CUSTOMER / unknown id → 404", async () => {
    for (const id of [admin.id, customer.id, "does-not-exist"]) {
      const res = await as(adminCookie).get(`/api/admin/staff/${id}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.message, "Staff member not found");
    }
  });

  test("create → 201 STAFF who can sign in to the admin; duplicate email → 409", async () => {
    const email = newEmail();
    const res = await as(adminCookie).post("/api/admin/staff", {
      name: "  New Staff ",
      email: email.toUpperCase(),
      password: "password123",
      phone: "",
    });
    assert.equal(res.status, 201);
    const created = adminStaffSchema.parse(res.body.data);
    assert.equal(created.name, "New Staff");
    assert.equal(created.email, email);
    assert.equal(created.phone, null);
    assert.deepEqual(created.hotels, []);
    assert.equal(res.body.data.passwordHash, undefined);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: created.id }, select: { role: true } });
    assert.equal(row.role, "STAFF");

    const login = await request(app)
      .post("/api/auth/admin/login")
      .send({ email, password: "password123" });
    assert.equal(login.status, 200);

    const dup = await as(adminCookie).post("/api/admin/staff", {
      name: "Dup",
      email,
      password: "password123",
    });
    assert.equal(dup.status, 409);
    assert.deepEqual(dup.body.error.details.fieldErrors.email, ["Email already registered"]);

    const short = await as(adminCookie).post("/api/admin/staff", {
      name: "Short",
      email: newEmail(),
      password: "short",
    });
    assert.equal(short.status, 400);
  });

  test("edit name and phone", async () => {
    const res = await as(adminCookie).patch(`/api/admin/staff/${staff.id}`, {
      name: "Renamed Staff",
      phone: " 0812345678 ",
    });
    assert.equal(res.status, 200);
    const updated = adminStaffSchema.parse(res.body.data);
    assert.equal(updated.name, "Renamed Staff");
    assert.equal(updated.phone, "0812345678");

    const cleared = adminStaffSchema.parse(
      (await as(adminCookie).patch(`/api/admin/staff/${staff.id}`, { name: "Renamed", phone: "" })).body
        .data,
    );
    assert.equal(cleared.phone, null);
    assert.equal(
      (await as(adminCookie).patch(`/api/admin/staff/${admin.id}`, { name: "x", phone: null })).status,
      404,
    );
  });

  test("assign → staff can read the hotel; twice → 409; unknown hotel → 404", async () => {
    const before = await as(staffCookie).get(`/api/admin/hotels/${h2.hotelId}`);
    assert.equal(before.status, 403);

    const res = await as(adminCookie).post(`/api/admin/staff/${staff.id}/hotels`, { hotelId: h2.hotelId });
    assert.equal(res.status, 201);
    const assigned = adminStaffSchema.parse(res.body.data);
    const h2Entry = assigned.hotels.find((h) => h.id === h2.hotelId);
    assert.ok(h2Entry);
    assert.equal(h2Entry.isActive, false);

    assert.equal((await as(staffCookie).get(`/api/admin/hotels/${h2.hotelId}`)).status, 200);

    const again = await as(adminCookie).post(`/api/admin/staff/${staff.id}/hotels`, { hotelId: h2.hotelId });
    assert.equal(again.status, 409);
    const unknown = await as(adminCookie).post(`/api/admin/staff/${staff.id}/hotels`, {
      hotelId: "does-not-exist",
    });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error.message, "Hotel not found");
    const notStaff = await as(adminCookie).post(`/api/admin/staff/${customer.id}/hotels`, {
      hotelId: h1.hotelId,
    });
    assert.equal(notStaff.status, 404);
  });

  test("remove → 204 and access ends; again → 404", async () => {
    await prisma.hotelStaff.upsert({
      where: { userId_hotelId: { userId: staff.id, hotelId: h2.hotelId } },
      create: { userId: staff.id, hotelId: h2.hotelId },
      update: {},
    });
    const res = await as(adminCookie).delete(`/api/admin/staff/${staff.id}/hotels/${h2.hotelId}`);
    assert.equal(res.status, 204);
    assert.equal((await as(staffCookie).get(`/api/admin/hotels/${h2.hotelId}`)).status, 403);
    assert.equal((await as(staffCookie).get(`/api/admin/hotels/${h1.hotelId}`)).status, 200);

    const again = await as(adminCookie).delete(`/api/admin/staff/${staff.id}/hotels/${h2.hotelId}`);
    assert.equal(again.status, 404);
  });

  /** A STAFF member who can really sign in (fixture users have a dummy hash). */
  async function createLoginableStaff(password = "password123") {
    const email = newEmail();
    const res = await as(adminCookie).post("/api/admin/staff", { name: "Leaver", email, password });
    assert.equal(res.status, 201);
    const id = adminStaffSchema.parse(res.body.data).id;
    const login = await request(app).post("/api/auth/admin/login").send({ email, password });
    assert.equal(login.status, 200);
    const cookie = `admin_sid=${await signIn(id, "ADMIN")}`;
    return { id, email, cookie };
  }

  test("deactivate → sessions revoked at once, login refused like a wrong password; reactivate → login works", async () => {
    const leaver = await createLoginableStaff();
    assert.equal((await as(leaver.cookie).get("/api/auth/admin/me")).status, 200);

    const off = await as(adminCookie).patch(`/api/admin/staff/${leaver.id}/status`, { isActive: false });
    assert.equal(off.status, 200);
    assert.equal(adminStaffSchema.parse(off.body.data).isActive, false);
    assert.equal(await prisma.session.count({ where: { userId: leaver.id } }), 0);
    assert.equal((await as(leaver.cookie).get("/api/admin/hotels")).status, 401);

    const login = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: leaver.email, password: "password123" });
    assert.equal(login.status, 401);
    assert.deepEqual(login.body, { error: { code: "UNAUTHORIZED", message: "Invalid email or password" } });
    const webLogin = await request(app).post("/api/auth/login").send({ email: leaver.email, password: "password123" });
    assert.equal(webLogin.status, 401);

    const listed = adminStaffListSchema.parse(
      (await as(adminCookie).get(`/api/admin/staff?q=${encodeURIComponent(leaver.email)}`)).body.data,
    );
    assert.equal(listed.items[0]?.isActive, false);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "STAFF", entityId: leaver.id, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
      select: { changes: true },
    });
    assert.deepEqual(audit?.changes, [{ field: "isActive", before: true, after: false }]);

    const on = await as(adminCookie).patch(`/api/admin/staff/${leaver.id}/status`, { isActive: true });
    assert.equal(adminStaffSchema.parse(on.body.data).isActive, true);
    const back = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: leaver.email, password: "password123" });
    assert.equal(back.status, 200);
  });

  test("a session row left on a deactivated user is refused and deleted", async () => {
    const leaver = await createLoginableStaff();
    await prisma.user.update({ where: { id: leaver.id }, data: { isActive: false } });
    const before = await prisma.session.count({ where: { userId: leaver.id } });
    assert.equal((await as(leaver.cookie).get("/api/auth/admin/me")).status, 401);
    assert.equal(await prisma.session.count({ where: { userId: leaver.id } }), before - 1);
  });

  test("status: own account → 409, ADMIN/unknown id → 404, STAFF caller → 403, bad body → 400", async () => {
    const self = await as(adminCookie).patch(`/api/admin/staff/${admin.id}/status`, { isActive: false });
    assert.equal(self.status, 409);
    const other = await createFixtureUser(LABEL, "ADMIN");
    assert.equal(
      (await as(adminCookie).patch(`/api/admin/staff/${other.id}/status`, { isActive: false })).status,
      404,
    );
    assert.equal(
      (await as(adminCookie).patch(`/api/admin/staff/nope/status`, { isActive: false })).status,
      404,
    );
    assert.equal(
      (await as(staffCookie).patch(`/api/admin/staff/${staff.id}/status`, { isActive: false })).status,
      403,
    );
    assert.equal(
      (await as(adminCookie).patch(`/api/admin/staff/${staff.id}/status`, { isActive: "no" })).status,
      400,
    );
  });

  test("reset password → old sessions + old password stop working, new one works, audited without the value", async () => {
    const s = await createLoginableStaff();
    const res = await as(adminCookie).post(`/api/admin/staff/${s.id}/password`, { password: "temporary456" });
    assert.equal(res.status, 204);
    assert.equal((await as(s.cookie).get("/api/auth/admin/me")).status, 401);
    const old = await request(app).post("/api/auth/admin/login").send({ email: s.email, password: "password123" });
    assert.equal(old.status, 401);
    const fresh = await request(app).post("/api/auth/admin/login").send({ email: s.email, password: "temporary456" });
    assert.equal(fresh.status, 200);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "STAFF", entityId: s.id, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
      select: { changes: true },
    });
    assert.deepEqual(audit?.changes, [{ field: "password", before: null, after: "reset" }]);
    assert.ok(!JSON.stringify(audit).includes("temporary456"));

    assert.equal((await as(adminCookie).post(`/api/admin/staff/nope/password`, { password: "temporary456" })).status, 404);
    assert.equal((await as(adminCookie).post(`/api/admin/staff/${s.id}/password`, { password: "short" })).status, 400);
    assert.equal((await as(staffCookie).post(`/api/admin/staff/${s.id}/password`, { password: "temporary456" })).status, 403);
  });
});
