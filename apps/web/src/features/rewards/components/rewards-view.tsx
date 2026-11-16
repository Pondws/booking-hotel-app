"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { REWARD_TIER_RULES, REWARD_TIERS, type RewardTier, type RewardsSummary } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import { formatDateRange } from "@/features/hotels/format";
import { useMyRewards } from "../hooks";

export const TIER_LABEL: Record<RewardTier, string> = {
  MEMBER: "สมาชิก",
  SILVER: "ซิลเวอร์",
  GOLD: "โกลด์",
};

const points = (n: number) => n.toLocaleString("th-TH");

/** The signed-in customer's tier, balance, progress and points history. */
export function RewardsStatus() {
  const { data, isPending, isError, refetch, isFetching } = useMyRewards();

  if (isPending) {
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลดแต้มสะสม">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <p className="text-sm">โหลดแต้มสะสมไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <TierCard rewards={data} />
      <History rewards={data} />
    </div>
  );
}

function TierCard({ rewards }: { rewards: RewardsSummary }) {
  const { tier, nextTier, lifetimePoints } = rewards;
  const progress = nextTier
    ? Math.min(
        100,
        Math.round(
          ((lifetimePoints - REWARD_TIER_RULES[tier].minPoints) /
            (nextTier.minPoints - REWARD_TIER_RULES[tier].minPoints)) *
            100,
        ),
      )
    : 100;
  return (
    <section aria-labelledby="tier-heading" className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">ระดับสมาชิก</p>
          <h2 id="tier-heading" className="flex items-center gap-2 text-2xl font-semibold">
            <Crown aria-hidden className="size-6 text-primary" />
            {TIER_LABEL[tier]}
          </h2>
          <p className="text-sm text-muted-foreground">
            ได้ {rewards.pointsPer100} แต้มทุก ฿100 ที่ชำระ
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">แต้มที่ใช้ได้</p>
          <p className="text-3xl font-semibold tabular-nums">{points(rewards.balance)}</p>
          <p className="text-sm text-muted-foreground">1 แต้ม = ฿1</p>
        </div>
      </div>
      <div className="space-y-2">
        <progress
          className="block h-2 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
          aria-label="ความคืบหน้าสู่ระดับถัดไป"
          max={100}
          value={progress}
        />
        <p className="text-sm">
          {nextTier
            ? `อีก ${points(nextTier.pointsToGo)} แต้มสู่ระดับ${TIER_LABEL[nextTier.tier]} (สะสมแล้ว ${points(lifetimePoints)} แต้ม)`
            : `คุณอยู่ระดับสูงสุดแล้ว (สะสมแล้ว ${points(lifetimePoints)} แต้ม)`}
        </p>
      </div>
    </section>
  );
}

function History({ rewards }: { rewards: RewardsSummary }) {
  return (
    <section aria-labelledby="history-heading" className="space-y-3">
      <h2 id="history-heading" className="text-lg font-semibold">
        ประวัติแต้ม
      </h2>
      {rewards.history.length === 0 ? (
        <div className="space-y-3 rounded-xl border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            ยังไม่มีแต้ม แต้มจะเข้าบัญชีหลังเช็คเอาท์จากการเข้าพักที่ชำระเงินแล้ว
          </p>
          <Button asChild variant="outline">
            <Link href="/hotels">ค้นหาที่พัก</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rewards.history.map((item) => (
            <li key={item.code} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <Link href={`/account/bookings/${item.code}`} className="font-medium hover:underline">
                  {item.hotelName}
                </Link>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">{formatDateRange(item.checkIn, item.checkOut)}</span>
                  <BookingStatusBadge status={item.status} />
                </p>
              </div>
              <div className="space-y-0.5 text-right text-sm tabular-nums">
                {item.pointsEarned > 0 && <p className="font-medium text-primary">+{points(item.pointsEarned)} แต้ม</p>}
                {item.pointsRedeemed > 0 && (
                  <p
                    className={cn(
                      ["CANCELLED", "EXPIRED"].includes(item.status) && "text-muted-foreground line-through",
                    )}
                  >
                    −{points(item.pointsRedeemed)} แต้ม
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** How the program works — shown to everyone, signed in or not. */
export function RewardsTiers() {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {REWARD_TIERS.map((tier) => (
        <li key={tier} className="space-y-2 rounded-xl border p-4">
          <p className="flex items-center gap-2 font-semibold">
            {TIER_LABEL[tier]}
            {tier === "GOLD" && <Badge variant="secondary">สูงสุด</Badge>}
          </p>
          <p className="text-sm text-muted-foreground">
            {REWARD_TIER_RULES[tier].minPoints === 0
              ? "เริ่มต้นทันทีที่สมัคร"
              : `สะสมครบ ${points(REWARD_TIER_RULES[tier].minPoints)} แต้ม`}
          </p>
          <p className="text-sm">ได้ {REWARD_TIER_RULES[tier].pointsPer100} แต้มทุก ฿100</p>
        </li>
      ))}
    </ul>
  );
}
