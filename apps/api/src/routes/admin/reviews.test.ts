import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import { adminAuditLogListSchema, adminReviewListSchema, adminReviewSchema, hotelReviewListSchema } from "@booking/shared";
import { app } from "../../app";
import { prisma } from "../../lib/prisma";
import { recomputeHotelRating } from "../../services/review.service";
import {
  addBooking,
  assignStaff,
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../../test/catalog-fixtures";

const LABEL = "admin-reviews";

describe("admin reviews API", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let staffCookie = "";
  let adminCookie = "";
  let customerAdminCookie = "";
  let webCookie = "";

  const list = (query = "", cookie = staffCookie) =>
    request(app).get(`/api/admin/reviews${query}`).set("Cookie", cookie);
  const patch = (id: string, body: object, cookie = staffCookie) =>
    request(app).patch(`/api/admin/reviews/${id}`).set("Cookie", cookie).send(body);
  const hotel = (id: string) =>
    prisma.hotel.findUniqueOrThrow({ where: { id }, select: { ratingAvg: true, reviewCount: true } });
  const auditRows = (entityId: string) => prisma.auditLog.findMany({ where: { entityType: "REVIEW", entityId } });

  // Each review gets its own past stay on the fixture's first room.
  let day = 0;
  const review = async (fx: CatalogFixture, rating: number, isHidden = false) => {
    const start = Date.UTC(2025, 0, 1) + day++ * 2 * 86_400_000;
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
    const b = await addBooking(fx, fx.roomTypes[0]!.roomIds[0]!, iso(start), iso(start + 86_400_000), "COMPLETED");
    const row = await prisma.review.create({
      data: {
        bookingId: b.id,
        userId: fx.userId,
        hotelId: fx.hotelId,
        rating,
        comment: `${LABEL} ${rating}`,
        isHidden,
        hiddenAt: isHidden ? new Date() : null,
      },
      select: { id: true },
    });
    await prisma.$transaction((tx) => recomputeHotelRating(tx, fx.hotelId));
    return { id: row.id, code: b.code };
  };

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    const spec = [{ capacity: 2, basePrice: 1000, rooms: 1 }];
    mine = await createCatalogFixture(LABEL, { roomTypes: spec });
    other = await createCatalogFixture(LABEL, { roomTypes: spec });
    const staff = await createFixtureUser(LABEL, "STAFF");
    const admin = await createFixtureUser(LABEL, "ADMIN");
    const customer = await createFixtureUser(LABEL, "CUSTOMER");
    await assignStaff(staff.id, mine.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
    customerAdminCookie = `admin_sid=${await signIn(customer.id, "ADMIN")}`;
    webCookie = `sid=${await signIn(staff.id, "WEB")}`;
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { hotelId: { in: [mine.hotelId, other.hotelId] } } });
    await clearBookings(mine);
    await clearBookings(other);
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  describe("access", () => {
    test("web session → 401, customer → 403", async () => {
      assert.equal((await list("", webCookie)).status, 401);
      assert.equal((await list("", customerAdminCookie)).status, 403);
      assert.equal((await patch("x", { isHidden: true }, customerAdminCookie)).status, 403);
    });

    test("staff list holds only their hotels; another hotel's filter → 403", async () => {
      const own = await review(mine, 4);
      const theirs = await review(other, 2);
      const res = await list();
      assert.equal(res.status, 200);
      const ids = adminReviewListSchema.parse(res.body.data).items.map((r) => r.id);
      assert.ok(ids.includes(own.id));
      assert.ok(!ids.includes(theirs.id));
      assert.equal((await list(`?hotelId=${other.hotelId}`)).status, 403);

      const all = adminReviewListSchema.parse((await list(`?hotelId=${other.hotelId}`, adminCookie)).body.data);
      assert.deepEqual(
        all.items.map((r) => r.id),
        [theirs.id],
      );
    });

    test("staff PATCH on another hotel's review → 404, nothing changes", async () => {
      const theirs = await review(other, 2);
      assert.equal((await patch(theirs.id, { isHidden: true })).status, 404);
      const row = await prisma.review.findUniqueOrThrow({ where: { id: theirs.id } });
      assert.equal(row.isHidden, false);
      assert.equal((await auditRows(theirs.id)).length, 0);
    });
  });

  test("list: newest first, visibility filter, review fields", async () => {
    const older = await review(mine, 5);
    const hidden = await review(mine, 1, true);
    const base = `?hotelId=${mine.hotelId}`;

    const all = adminReviewListSchema.parse((await list(base)).body.data);
    assert.deepEqual(
      all.items.map((r) => r.id),
      [hidden.id, older.id],
    );
    const first = all.items[0]!;
    assert.equal(first.bookingCode, hidden.code);
    assert.equal(first.hotel.id, mine.hotelId);
    assert.equal(first.isHidden, true);
    assert.ok(first.hiddenAt);

    const visible = adminReviewListSchema.parse((await list(`${base}&visibility=visible`)).body.data);
    assert.deepEqual(
      visible.items.map((r) => r.id),
      [older.id],
    );
    const onlyHidden = adminReviewListSchema.parse((await list(`${base}&visibility=hidden`)).body.data);
    assert.deepEqual(
      onlyHidden.items.map((r) => r.id),
      [hidden.id],
    );
    assert.equal((await list(`${base}&visibility=nope`)).status, 400);
  });

  test("hide → rating recomputed, gone from the hotel page, audited on the review and the hotel", async () => {
    const good = await review(mine, 5);
    const bad = await review(mine, 1);
    assert.deepEqual(await hotel(mine.hotelId), { ratingAvg: 3, reviewCount: 2 });

    const res = await patch(bad.id, { isHidden: true });
    assert.equal(res.status, 200);
    const body = adminReviewSchema.parse(res.body.data);
    assert.equal(body.isHidden, true);
    assert.ok(body.hiddenAt);
    assert.deepEqual(await hotel(mine.hotelId), { ratingAvg: 5, reviewCount: 1 });

    const { slug } = await prisma.hotel.findUniqueOrThrow({ where: { id: mine.hotelId }, select: { slug: true } });
    const pub = hotelReviewListSchema.parse((await request(app).get(`/api/hotels/${slug}/reviews`)).body.data);
    assert.deepEqual(
      pub.items.map((r) => r.id),
      [good.id],
    );

    const [row, ...rest] = await auditRows(bad.id);
    assert.equal(rest.length, 0);
    assert.equal(row?.action, "UPDATE");
    assert.equal(row?.entityLabel, bad.code);
    assert.equal(row?.hotelId, mine.hotelId);
    assert.deepEqual(row?.changes, [{ field: "isHidden", before: false, after: true }]);

    const history = await request(app)
      .get(`/api/admin/audit-logs?entityType=HOTEL&entityId=${mine.hotelId}`)
      .set("Cookie", staffCookie);
    const entries = adminAuditLogListSchema.parse(history.body.data).items;
    assert.ok(entries.some((e) => e.entityType === "REVIEW" && e.entityId === bad.id));
  });

  test("same value again → 200 unchanged, no audit row; show → hiddenAt cleared, rating back", async () => {
    await review(mine, 5);
    const bad = await review(mine, 1);
    assert.equal((await patch(bad.id, { isHidden: true })).status, 200);
    const again = await patch(bad.id, { isHidden: true });
    assert.equal(again.status, 200);
    assert.equal(adminReviewSchema.parse(again.body.data).isHidden, true);
    assert.equal((await auditRows(bad.id)).length, 1);

    const shown = adminReviewSchema.parse((await patch(bad.id, { isHidden: false })).body.data);
    assert.equal(shown.isHidden, false);
    assert.equal(shown.hiddenAt, null);
    assert.deepEqual(await hotel(mine.hotelId), { ratingAvg: 3, reviewCount: 2 });
    assert.equal((await auditRows(bad.id)).length, 2);
  });

  test("bad body → 400; unknown review → 404", async () => {
    const r = await review(mine, 3);
    assert.equal((await patch(r.id, {})).status, 400);
    assert.equal((await patch(r.id, { isHidden: "yes" })).status, 400);
    assert.equal((await patch("nope", { isHidden: true }, adminCookie)).status, 404);
  });
});
