import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { IMAGE_UPLOAD_MAX_BYTES, uploadedImageSchema } from "@booking/shared";
import { app } from "../../app";
import { env } from "../../env";
import { prisma } from "../../lib/prisma";
import { cleanupCatalogFixtures, createFixtureUser, signIn } from "../../test/catalog-fixtures";

const LABEL = "admin-uploads";
// Smallest valid signatures (the API sniffs magic bytes, not just Content-Type)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(8)]);

describe("POST /api/admin/uploads/images", () => {
  let staffCookie = "";
  let webCookie = "";
  const uploaded: string[] = [];

  const upload = (body: Buffer, type: string, cookie = staffCookie) =>
    request(app).post("/api/admin/uploads/images").set("Cookie", cookie).set("Content-Type", type).send(body);

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    const staff = await createFixtureUser(LABEL, "STAFF");
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    webCookie = `sid=${await signIn(staff.id, "WEB")}`;
  });

  after(async () => {
    await Promise.all(uploaded.map((file) => rm(path.join(env.UPLOAD_DIR, file), { force: true })));
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  for (const [type, body, ext] of [
    ["image/png", PNG, ".png"],
    ["image/jpeg", JPEG, ".jpg"],
    ["image/webp", WEBP, ".webp"],
  ] as const) {
    test(`stores a ${type} and serves it back`, async () => {
      const res = await upload(body, type);
      assert.equal(res.status, 201);
      const { url } = uploadedImageSchema.parse(res.body.data);
      const { pathname } = new URL(url);
      assert.match(pathname, new RegExp(`^/uploads/[0-9a-f-]{36}\\${ext}$`));
      uploaded.push(path.basename(pathname));

      const served = await request(app).get(pathname);
      assert.equal(served.status, 200);
      assert.equal(served.headers["content-type"], type);
      assert.equal(served.headers["x-content-type-options"], "nosniff");
      assert.deepEqual(Buffer.from(served.body as Buffer), body);
    });
  }

  test("a type outside the allow-list → 400", async () => {
    const res = await upload(Buffer.from("<svg/>"), "image/svg+xml");
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_FAILED");
  });

  test("bytes that don't match the Content-Type → 400", async () => {
    const res = await upload(Buffer.from("not really a png"), "image/png");
    assert.equal(res.status, 400);
  });

  test("an empty body → 400", async () => {
    assert.equal((await upload(Buffer.alloc(0), "image/png")).status, 400);
  });

  test("a file over the limit → 413", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(IMAGE_UPLOAD_MAX_BYTES)]);
    assert.equal((await upload(big, "image/png")).status, 413);
  });

  test("a web session → 401", async () => {
    assert.equal((await upload(PNG, "image/png", webCookie)).status, 401);
  });
});
