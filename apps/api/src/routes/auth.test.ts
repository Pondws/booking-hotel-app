import assert from "node:assert/strict";
import { after, test } from "node:test";
import request from "supertest";
import { app } from "../app";
import { generateToken, hashToken } from "../lib/session-token";
import { prisma } from "../lib/prisma";

const PASSWORD = "Password123!";
const RUN = Date.now();
let n = 0;
const testEmail = () => `auth-test+${RUN}-${++n}@test.local`;

const createdEmails: string[] = [];
const seedTokens: string[] = [];

after(async () => {
  const hashes = seedTokens.map(hashToken);
  const seedSessions = await prisma.session.findMany({
    where: { tokenHash: { in: hashes } },
    select: { id: true },
  });
  await prisma.session.deleteMany({ where: { id: { in: seedSessions.map((s) => s.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

function setCookies(res: request.Response): string[] {
  const raw: unknown = res.headers["set-cookie"];
  if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === "string");
  return typeof raw === "string" ? [raw] : [];
}

function cookieHeader(res: request.Response, name: string): string | undefined {
  return setCookies(res).find((c) => c.startsWith(`${name}=`));
}

function cookieValue(res: request.Response, name: string): string | undefined {
  const header = cookieHeader(res, name);
  if (!header) return undefined;
  const value = header.slice(name.length + 1).split(";")[0];
  return value ? decodeURIComponent(value) : undefined;
}

async function registerUser() {
  const email = testEmail();
  createdEmails.push(email);
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, name: "Auth Test" });
  return { email, res, token: cookieValue(res, "sid") };
}

async function loginSeed(path: "/api/auth/login" | "/api/auth/admin/login", email: string) {
  const res = await request(app).post(path).send({ email, password: PASSWORD });
  const token = cookieValue(res, path === "/api/auth/login" ? "sid" : "admin_sid");
  if (token) seedTokens.push(token);
  return { res, token };
}

// ---------- Register ----------

test("register → 201 PublicUser + sid cookie (HttpOnly, SameSite=Lax)", async () => {
  const { email, res, token } = await registerUser();
  assert.equal(res.status, 201);
  assert.equal(res.body.data.email, email);
  assert.equal(res.body.data.role, "CUSTOMER");
  assert.deepEqual(Object.keys(res.body.data).sort(), ["email", "id", "name", "phone", "role"]);
  const header = cookieHeader(res, "sid");
  assert.ok(header, "sid cookie set");
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  assert.ok(token);
});

test("GET /me with the register cookie returns the user", async () => {
  const { email, token } = await registerUser();
  assert.ok(token);
  const me = await request(app).get("/api/auth/me").set("Cookie", `sid=${token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, email);
});

test("duplicate register → 409 'Email already registered'", async () => {
  const { email } = await registerUser();
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, name: "Dup" });
  assert.equal(res.status, 409);
  assert.deepEqual(res.body, {
    error: { code: "CONFLICT", message: "Email already registered" },
  });
});

test("register with an invalid body → 400 VALIDATION_FAILED with fieldErrors", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: "not-an-email", password: "short", name: "" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_FAILED");
  const fieldErrors = res.body.error.details.fieldErrors;
  assert.ok(Array.isArray(fieldErrors.email));
  assert.ok(Array.isArray(fieldErrors.password));
  assert.ok(Array.isArray(fieldErrors.name));
});

test("no response body contains passwordHash", async () => {
  const { email, res: reg, token } = await registerUser();
  assert.ok(token);
  const login = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  const me = await request(app).get("/api/auth/me").set("Cookie", `sid=${token}`);
  const adminLogin = await loginSeed("/api/auth/admin/login", "staff@booking.local");
  const adminMe = await request(app)
    .get("/api/auth/admin/me")
    .set("Cookie", `admin_sid=${adminLogin.token}`);
  for (const res of [reg, login, me, adminLogin.res, adminMe]) {
    assert.ok(res.status < 300, `status ${res.status}`);
    assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
  }
});

// ---------- Login ----------

test("login with seeded customer → 200 PublicUser + sid", async () => {
  const { res, token } = await loginSeed("/api/auth/login", "customer@booking.local");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.email, "customer@booking.local");
  assert.equal(res.body.data.role, "CUSTOMER");
  assert.ok(token);
});

test("login works with mixed-case email", async () => {
  const { res, token } = await loginSeed("/api/auth/login", "Customer@Booking.Local");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.email, "customer@booking.local");
  assert.ok(token);
});

test("login creates a WEB session for any role (admin on the web site)", async () => {
  const { res, token } = await loginSeed("/api/auth/login", "admin@booking.local");
  assert.equal(res.status, 200);
  assert.ok(token);
  const row = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  assert.equal(row?.audience, "WEB");
});

test("wrong password and unknown email → deepEqual 401 bodies", async () => {
  const wrong = await request(app)
    .post("/api/auth/login")
    .send({ email: "customer@booking.local", password: "WrongPassword!" });
  const unknown = await request(app)
    .post("/api/auth/login")
    .send({ email: `nobody-${RUN}@test.local`, password: PASSWORD });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.deepEqual(wrong.body, {
    error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
  });
  assert.equal(cookieHeader(wrong, "sid"), undefined);
  assert.equal(cookieHeader(unknown, "sid"), undefined);
});

test("logout → 204, then /me → 401 and the session row is gone", async () => {
  const { token } = await registerUser();
  assert.ok(token);
  const out = await request(app).post("/api/auth/logout").set("Cookie", `sid=${token}`);
  assert.equal(out.status, 204);
  const header = cookieHeader(out, "sid");
  assert.ok(header);
  assert.match(header, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  const me = await request(app).get("/api/auth/me").set("Cookie", `sid=${token}`);
  assert.equal(me.status, 401);
  assert.deepEqual(me.body, {
    error: { code: "UNAUTHORIZED", message: "Authentication required" },
  });
  assert.equal(await prisma.session.count({ where: { tokenHash: hashToken(token) } }), 0);
});

test("logout without cookie → 204 and Set-Cookie clears sid", async () => {
  const out = await request(app).post("/api/auth/logout");
  assert.equal(out.status, 204);
  const header = cookieHeader(out, "sid");
  assert.ok(header, "sid cleared");
  assert.match(header, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
});

test("GET /me without cookie → 401", async () => {
  const me = await request(app).get("/api/auth/me");
  assert.equal(me.status, 401);
  assert.equal(me.body.error.code, "UNAUTHORIZED");
});

// ---------- Admin login ----------

test("admin login as customer → 403 'Staff access only', no session created", async () => {
  const customer = await prisma.user.findUniqueOrThrow({
    where: { email: "customer@booking.local" },
    select: { id: true },
  });
  const before = await prisma.session.count({ where: { userId: customer.id } });
  const { res, token } = await loginSeed("/api/auth/admin/login", "customer@booking.local");
  assert.equal(res.status, 403);
  assert.deepEqual(res.body, { error: { code: "FORBIDDEN", message: "Staff access only" } });
  assert.equal(token, undefined);
  assert.equal(await prisma.session.count({ where: { userId: customer.id } }), before);
});

test("admin login with wrong password → 401 'Invalid email or password'", async () => {
  const res = await request(app)
    .post("/api/auth/admin/login")
    .send({ email: "admin@booking.local", password: "WrongPassword!" });
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, {
    error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
  });
});

for (const email of ["staff@booking.local", "admin@booking.local"]) {
  test(`admin login as ${email} → 200 + admin_sid; /admin/me works; ADMIN session`, async () => {
    const { res, token } = await loginSeed("/api/auth/admin/login", email);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, email);
    const header = cookieHeader(res, "admin_sid");
    assert.ok(header);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Lax/i);
    assert.equal(cookieHeader(res, "sid"), undefined);
    assert.ok(token);
    const row = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    assert.equal(row?.audience, "ADMIN");
    const me = await request(app).get("/api/auth/admin/me").set("Cookie", `admin_sid=${token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, email);
  });
}

test("admin logout → 204, clears admin_sid, session row gone", async () => {
  const { token } = await loginSeed("/api/auth/admin/login", "staff@booking.local");
  assert.ok(token);
  const out = await request(app).post("/api/auth/admin/logout").set("Cookie", `admin_sid=${token}`);
  assert.equal(out.status, 204);
  const header = cookieHeader(out, "admin_sid");
  assert.ok(header);
  assert.match(header, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  assert.equal(await prisma.session.count({ where: { tokenHash: hashToken(token) } }), 0);
  const me = await request(app).get("/api/auth/admin/me").set("Cookie", `admin_sid=${token}`);
  assert.equal(me.status, 401);
});

// ---------- Audience isolation ----------

test("sid cookie sent to POST /api/admin/hotels → 401", async () => {
  const { token } = await loginSeed("/api/auth/login", "admin@booking.local");
  assert.ok(token);
  const res = await request(app)
    .post("/api/admin/hotels")
    .set("Cookie", `sid=${token}`)
    .send({ name: `App Test ${RUN} iso`, city: "Testville", address: "1 Test Street" });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
});

test("admin_sid cookie sent to GET /api/auth/me → 401", async () => {
  const { token } = await loginSeed("/api/auth/admin/login", "admin@booking.local");
  assert.ok(token);
  const res = await request(app).get("/api/auth/me").set("Cookie", `admin_sid=${token}`);
  assert.equal(res.status, 401);
});

test("a WEB token sent as admin_sid to GET /api/auth/admin/me → 401", async () => {
  const { token } = await loginSeed("/api/auth/login", "admin@booking.local");
  assert.ok(token);
  const res = await request(app).get("/api/auth/admin/me").set("Cookie", `admin_sid=${token}`);
  assert.equal(res.status, 401);
  // The WEB session is still valid for its own audience.
  const web = await request(app).get("/api/auth/me").set("Cookie", `sid=${token}`);
  assert.equal(web.status, 200);
});

// ---------- Expiry ----------

test("expired session → 401 and the row is deleted", async () => {
  const { email } = await registerUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  const token = generateToken();
  const row = await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      audience: "WEB",
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const res = await request(app).get("/api/auth/me").set("Cookie", `sid=${token}`);
  assert.equal(res.status, 401);
  assert.equal(await prisma.session.count({ where: { id: row.id } }), 0);
});

// ---------- Body parser ----------

test("JSON body over 100kb to POST /api/auth/login → 413 VALIDATION_FAILED envelope", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send(JSON.stringify({ email: "a@b.co", password: "x".repeat(110 * 1024) }));
  assert.equal(res.status, 413);
  assert.deepEqual(res.body, {
    error: { code: "VALIDATION_FAILED", message: "Invalid request body" },
  });
});
