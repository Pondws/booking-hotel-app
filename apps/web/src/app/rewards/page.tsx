import type { Metadata } from "next";
import { Suspense } from "react";
import { POINTS_MAX_SHARE, POINTS_MIN_REDEEM } from "@booking/shared";
import { Skeleton } from "@booking/ui/components/skeleton";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { RewardsStatus, RewardsTiers } from "@/features/rewards/components/rewards-view";

export const metadata: Metadata = { title: "สมาชิกรางวัล · Booking Hotel" };

export default function RewardsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">สมาชิกรางวัล</h1>
        <p className="text-sm text-muted-foreground">
          ยิ่งพักมาก ยิ่งได้มาก สะสมแต้มจากทุกการเข้าพักแล้วใช้เป็นส่วนลดครั้งถัดไป
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <RequireAuth>
          <RewardsStatus />
        </RequireAuth>
      </Suspense>
      <section aria-labelledby="how-heading" className="space-y-4">
        <h2 id="how-heading" className="text-lg font-semibold">
          ระดับสมาชิกและวิธีสะสมแต้ม
        </h2>
        <RewardsTiers />
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>แต้มเข้าบัญชีหลังเช็คเอาท์ คิดจากยอดที่ชำระจริง (หลังหักส่วนลด) ตามระดับสมาชิกของคุณในตอนนั้น</li>
          <li>ระดับสมาชิกคิดจากแต้มที่สะสมทั้งหมด การใช้แต้มไม่ทำให้ระดับลดลง</li>
          <li>
            ใช้แต้มเป็นส่วนลดตอนจอง 1 แต้ม = ฿1 ครั้งละอย่างน้อย {POINTS_MIN_REDEEM} แต้ม และไม่เกิน{" "}
            {POINTS_MAX_SHARE * 100}% ของราคา
          </li>
          <li>ยกเลิกการจองหรือไม่ชำระเงินภายในเวลา แต้มที่ใช้ไปจะคืนเข้าบัญชีทันที</li>
        </ul>
      </section>
    </main>
  );
}
