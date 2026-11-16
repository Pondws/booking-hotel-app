import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, BadgePercent, CalendarX2, ShieldCheck, Tag } from "lucide-react";
import { HOLD_MINUTES, hotelSearchQuerySchema } from "@booking/shared";
import { buttonVariants } from "@booking/ui/components/button";
import { HotelResults, HotelResultsSkeleton } from "@/features/hotels/components/hotel-results";
import { DestinationGrid } from "@/features/destinations/components/destination-grid";
import { SearchBar } from "@/features/hotels/components/search-bar";

const FIRST_PAGE = hotelSearchQuerySchema.parse({});

const PROMISES = [
  {
    icon: Tag,
    title: "ราคาจริง ไม่มีบวกเพิ่ม",
    body: "เห็นราคาแต่ละคืนและราคารวมก่อนจอง ราคาที่จ่ายคือราคาที่เห็น",
  },
  {
    icon: CalendarX2,
    title: "ยกเลิกได้ก่อนวันเช็คอิน",
    body: "เปลี่ยนแผนได้ ยกเลิกก่อนวันเข้าพักรับเงินคืนเต็มจำนวน",
  },
  {
    icon: ShieldCheck,
    title: "ชำระเงินปลอดภัย",
    body: `ระบบกันห้องให้ ${HOLD_MINUTES} นาที แล้วชำระด้วยบัตรผ่าน Stripe`,
  },
  {
    icon: BadgeCheck,
    title: "รีวิวจากผู้เข้าพักจริง",
    body: "รีวิวได้เฉพาะคนที่เข้าพักเสร็จแล้วเท่านั้น",
  },
] as const;

export default function Home() {
  return (
    <main>
      {/* Hero band (Booking.com): brand colour behind the headline, search card overlapping its bottom edge */}
      <section aria-labelledby="hero-heading" className="bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-6xl space-y-3 px-4 pt-12 pb-24 sm:pt-16">
          <h1 id="hero-heading" className="text-3xl font-bold tracking-tight sm:text-5xl">
            หาที่พักที่ใช่ ในราคาที่เห็นจริง
          </h1>
          <p className="max-w-2xl text-base opacity-90 sm:text-lg">
            ค้นหาตามเมืองและวันที่ ดูห้องว่างและราคารวมทุกคืนก่อนจอง ยกเลิกได้ก่อนวันเช็คอิน
          </p>
        </div>
      </section>
      <div className="mx-auto -mt-16 w-full max-w-6xl px-4">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-12">
        <section aria-labelledby="destinations-heading" className="space-y-4">
          <SectionHeading
            id="destinations-heading"
            title="จุดหมายยอดนิยม"
            subtitle="เมืองที่มีโรงแรมให้เลือกมากที่สุด"
            action={{ href: "/destinations", label: "ดูทั้งหมด" }}
          />
          <DestinationGrid limit={4} />
        </section>

        <section aria-labelledby="hotels-heading" className="space-y-4">
          <SectionHeading
            id="hotels-heading"
            title="โรงแรมแนะนำ"
            subtitle="ใส่วันที่ในช่องค้นหาเพื่อดูเฉพาะโรงแรมที่มีห้องว่าง"
            action={{ href: "/hotels", label: "ดูทั้งหมด" }}
          />
          <Suspense fallback={<HotelResultsSkeleton />}>
            <HotelResults query={FIRST_PAGE} />
          </Suspense>
        </section>

        <section aria-labelledby="deals-heading">
          <div className="flex flex-col gap-4 rounded-xl border bg-secondary p-6 text-secondary-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <BadgePercent aria-hidden className="size-6" />
              </span>
              <div className="space-y-1">
                <h2 id="deals-heading" className="text-lg font-semibold">
                  ดีลพิเศษและสมาชิกรางวัล กำลังมาเร็ว ๆ นี้
                </h2>
                <p className="text-sm opacity-80">
                  ส่วนลดจองล่วงหน้า ดีลนาทีสุดท้าย และแต้มสะสมจากทุกการเข้าพัก
                </p>
              </div>
            </div>
            <Link href="/deals" className={buttonVariants({ variant: "outline" })}>
              ดูรายละเอียด
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="why-heading" className="space-y-4">
          <SectionHeading id="why-heading" title="ทำไมต้องจองกับเรา" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="space-y-2 rounded-xl border bg-card p-5">
                <Icon aria-hidden className="size-6 text-primary" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

type HeadingProps = {
  id: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
};

function SectionHeading({ id, title, subtitle, action }: HeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="space-y-1">
        <h2 id={id} className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {action.label}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}
