import type { LoginInput, PublicUser, RegisterInput } from "@booking/shared";
import type { Prisma, SessionAudience } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { SESSION_TTL_MS } from "../lib/cookies";
import { hashPassword, verifyPassword } from "../lib/password";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { prisma } from "../lib/prisma";
import { generateToken, hashToken } from "../lib/session-token";

export type SessionMeta = { ip?: string; userAgent?: string };

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
} as const satisfies Prisma.UserSelect;

const USER_AGENT_MAX = 255;

/**
 * Hash checked when the email is unknown, so both login failure paths run one
 * scrypt verify and take about the same time. Computed once at module load.
 */
const DUMMY_HASH: Promise<string> = hashPassword("dummy-password-that-never-matches");

function newSession(audience: SessionAudience, meta: SessionMeta) {
  const token = generateToken();
  const data = {
    tokenHash: hashToken(token),
    audience,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS[audience]),
    userAgent: meta.userAgent?.slice(0, USER_AGENT_MAX) ?? null,
    ip: meta.ip ?? null,
  } satisfies Prisma.SessionCreateWithoutUserInput;
  return { token, data };
}

export async function register(
  input: RegisterInput,
  meta: SessionMeta,
): Promise<{ user: PublicUser; token: string }> {
  const passwordHash = await hashPassword(input.password);
  const { token, data: session } = newSession("WEB", meta);
  try {
    // One nested write: the user and its WEB session are created atomically.
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: "CUSTOMER",
        sessions: { create: session },
      },
      select: publicUserSelect,
    });
    return { user, token };
  } catch (err) {
    if (isUniqueViolationOn(err, "email")) {
      throw new AppError(409, "CONFLICT", "Email already registered");
    }
    throw err;
  }
}

export async function login(
  input: LoginInput,
  audience: SessionAudience,
  meta: SessionMeta,
): Promise<{ user: PublicUser; token: string }> {
  const found = await prisma.user.findUnique({
    where: { email: input.email },
    omit: { passwordHash: false },
  });
  // Unknown emails still run one verify, against the dummy hash.
  const valid = await verifyPassword(input.password, found ? found.passwordHash : await DUMMY_HASH);
  if (!found || !valid) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
  }
  if (audience === "ADMIN" && found.role !== "ADMIN" && found.role !== "STAFF") {
    throw new AppError(403, "FORBIDDEN", "Staff access only");
  }
  const user: PublicUser = {
    id: found.id,
    email: found.email,
    name: found.name,
    phone: found.phone,
    role: found.role,
  };
  const { token, data } = newSession(audience, meta);
  await prisma.session.create({ data: { ...data, userId: user.id }, select: { id: true } });
  return { user, token };
}

export async function logout(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function resolveSession(
  token: string,
  audience: SessionAudience,
): Promise<{ user: PublicUser; sessionId: string } | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, audience: true, expiresAt: true, user: { select: publicUserSelect } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (session.audience !== audience) return null;
  return { user: session.user, sessionId: session.id };
}
