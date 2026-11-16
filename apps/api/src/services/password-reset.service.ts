import { PASSWORD_RESET_MINUTES, type ForgotPasswordData, type ResetPasswordInput } from "@booking/shared";
import { env } from "../env";
import { AppError } from "../lib/app-error";
import { getMailer } from "../lib/mailer";
import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { generateToken, hashToken } from "../lib/session-token";

const invalidLink = () =>
  new AppError(400, "VALIDATION_FAILED", "This reset link is invalid or has expired", {
    formErrors: ["This reset link is invalid or has expired"],
    fieldErrors: {},
  });

/** The customer site's reset page for `token` (first web origin). */
function resetUrl(token: string): string {
  const url = new URL("/reset-password", env.WEB_ORIGINS[0]);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Emails a one-time link to an active customer account. Says nothing about whether the email exists (the
 * route always answers 204). Staff and admins reset through the back-office instead. A new link replaces any
 * older ones.
 */
export async function requestPasswordReset(input: ForgotPasswordData, now: Date = new Date()): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || user.role !== "CUSTOMER" || !user.isActive) return;

  const token = generateToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_MINUTES * 60_000),
      },
      select: { id: true },
    }),
  ]);
  await getMailer().send({
    to: user.email,
    subject: "ตั้งรหัสผ่านใหม่ · Booking Hotel",
    text: [
      `สวัสดีคุณ ${user.name}`,
      "",
      `กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ครั้งเดียว ภายใน ${PASSWORD_RESET_MINUTES} นาที):`,
      resetUrl(token),
      "",
      "ถ้าคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้",
    ].join("\n"),
  });
}

/**
 * Sets the new password if the token is unused, unexpired and its account still active. Claiming the token is a
 * conditional update inside the transaction, so a link can't be used twice even concurrently. Every session of
 * the account is signed out.
 */
export async function resetPassword(input: ResetPasswordInput, now: Date = new Date()): Promise<void> {
  const tokenHash = hashToken(input.token);
  const found = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, user: { select: { isActive: true, role: true } } },
  });
  if (!found || !found.user.isActive || found.user.role !== "CUSTOMER") throw invalidLink();

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: found.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count === 0) throw invalidLink();
    await tx.user.update({ where: { id: found.userId }, data: { passwordHash }, select: { id: true } });
    await tx.session.deleteMany({ where: { userId: found.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: found.userId, id: { not: found.id } } });
  });
}
