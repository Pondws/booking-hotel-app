import {
  REWARD_TIERS,
  REWARD_TIER_RULES,
  rewardTierFor,
  type PublicUser,
  type RewardTier,
  type RewardsSummary,
} from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { fromDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";

const HISTORY_LIMIT = 20;

/** Bookings whose redeemed points are spent: they hold a room (unexpired PENDING, CONFIRMED) or are COMPLETED. */
export const spendingBookingWhere = (now: Date): Prisma.BookingWhereInput => ({
  OR: [{ status: { in: ["CONFIRMED", "COMPLETED"] } }, { status: "PENDING", expiresAt: { gt: now } }],
});

/** Lifetime points earned (COMPLETED stays only — that's the only status that sets pointsEarned). */
export async function lifetimePoints(userId: string): Promise<number> {
  const { _sum } = await prisma.booking.aggregate({
    where: { userId, status: "COMPLETED" },
    _sum: { pointsEarned: true },
  });
  return _sum.pointsEarned ?? 0;
}

/**
 * Spendable points: earned − redeemed on spending bookings. Derived, not stored, so a cancelled or lapsed
 * booking gives its points back without any extra write.
 */
export async function pointsBalance(userId: string, now: Date = new Date()): Promise<number> {
  const [earned, spent] = await Promise.all([
    lifetimePoints(userId),
    prisma.booking.aggregate({
      where: { userId, ...spendingBookingWhere(now) },
      _sum: { pointsRedeemed: true },
    }),
  ]);
  return earned - (spent._sum.pointsRedeemed ?? 0);
}

/** Points a stay paid `amount` earns at `tier`: floor(amount × rate / 100). */
export function pointsForStay(amount: Prisma.Decimal, tier: RewardTier): number {
  return amount.times(REWARD_TIER_RULES[tier].pointsPer100).div(100).floor().toNumber();
}

/** Points a check-out of this booking earns, at the guest's tier before the stay. */
export async function pointsForCheckOut(code: string): Promise<number> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { code },
    select: { userId: true, totalAmount: true },
  });
  const tier = rewardTierFor(await lifetimePoints(booking.userId));
  return pointsForStay(booking.totalAmount, tier);
}

export async function getMyRewards(user: PublicUser, now: Date = new Date()): Promise<RewardsSummary> {
  const [lifetime, balance, rows] = await Promise.all([
    lifetimePoints(user.id),
    pointsBalance(user.id, now),
    prisma.booking.findMany({
      where: { userId: user.id, OR: [{ pointsEarned: { gt: 0 } }, { pointsRedeemed: { gt: 0 } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_LIMIT,
      select: {
        code: true,
        status: true,
        expiresAt: true,
        checkIn: true,
        checkOut: true,
        pointsEarned: true,
        pointsRedeemed: true,
        room: { select: { roomType: { select: { hotel: { select: { name: true } } } } } },
      },
    }),
  ]);
  const tier = rewardTierFor(lifetime);
  const next = REWARD_TIERS[REWARD_TIERS.indexOf(tier) + 1];
  return {
    tier,
    lifetimePoints: lifetime,
    balance,
    pointsPer100: REWARD_TIER_RULES[tier].pointsPer100,
    nextTier: next
      ? {
          tier: next,
          minPoints: REWARD_TIER_RULES[next].minPoints,
          pointsToGo: REWARD_TIER_RULES[next].minPoints - lifetime,
        }
      : null,
    history: rows.map((r) => ({
      code: r.code,
      // Same effective status as the booking pages: a lapsed hold reads EXPIRED
      status: r.status === "PENDING" && r.expiresAt !== null && r.expiresAt <= now ? "EXPIRED" : r.status,
      hotelName: r.room.roomType.hotel.name,
      checkIn: fromDbDate(r.checkIn),
      checkOut: fromDbDate(r.checkOut),
      pointsEarned: r.pointsEarned,
      pointsRedeemed: r.pointsRedeemed,
    })),
  };
}
