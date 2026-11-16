import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import { app } from "../app";
import { setMailer, type MailMessage } from "../lib/mailer";
import { hashPassword, verifyPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/session-token";
import { cleanupCatalogFixtures, createFixtureUser, signIn } from "../test/catalog-fixtures";

const LABEL = "pwreset";

describe("forgot / reset password", () => {
  const sent: MailMessage[] = [];
  let customer: { id: string; email: string };
  let staff: { id: string; email: string };

  const forgot = (email: string) => request(app).post("/api/auth/forgot-password").send({ email });
  const reset = (token: string, password = "brand-new-pass") =>
    request(app).post("/api/auth/reset-password").send({ token, password });
  /** The raw token from the last email's link. */
  const lastToken = () => {
    const link = sent.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
    assert.ok(link, "an email with a link was sent");
    const token = new URL(link).searchParams.get("token");
    assert.ok(token);
    return token;
  };

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    setMailer({ send: async (m) => void sent.push(m) });
    customer = await createFixtureUser(LABEL);
    staff = await createFixtureUser(LABEL, "STAFF");
  });
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    sent.length = 0;
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: [customer.id, staff.id] } } });
    await prisma.user.update({ where: { id: customer.id }, data: { passwordHash: await hashPassword("old-password") } });
  });

  test("always 204; only an active customer gets an email", async () => {
    assert.equal((await forgot(customer.email.toUpperCase())).status, 204);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, customer.email);
    assert.match(sent[0]!.text, /\/reset-password\?token=/);

    assert.equal((await forgot("nobody-here@test.local")).status, 204);
    assert.equal((await forgot(staff.email)).status, 204);
    assert.equal(sent.length, 1);
  });

  test("only the token's hash is stored, and a new request replaces the old link", async () => {
    await forgot(customer.email);
    const first = lastToken();
    await forgot(customer.email);
    const second = lastToken();
    const rows = await prisma.passwordResetToken.findMany({ where: { userId: customer.id } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.tokenHash, hashToken(second));
    assert.equal((await reset(first)).status, 400);
  });

  test("reset sets the password, signs out every session, and the link works once", async () => {
    const web = await signIn(customer.id, "WEB");
    await forgot(customer.email);
    const token = lastToken();

    assert.equal((await reset(token)).status, 204);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: customer.id }, omit: { passwordHash: false } });
    assert.ok(await verifyPassword("brand-new-pass", user.passwordHash));
    assert.equal((await request(app).get("/api/auth/me").set("Cookie", `sid=${web}`)).status, 401);

    assert.equal((await reset(token, "another-pass-1")).status, 400);
  });

  test("an expired link is refused", async () => {
    await forgot(customer.email);
    const token = lastToken();
    await prisma.passwordResetToken.updateMany({
      where: { userId: customer.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await reset(token);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, "This reset link is invalid or has expired");
  });

  test("validation: short password", async () => {
    await forgot(customer.email);
    assert.equal((await reset(lastToken(), "short")).status, 400);
  });
});
