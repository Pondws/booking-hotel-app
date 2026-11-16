"use client";

import Link from "next/link";
import { CalendarCheck, ChevronRight, Crown, Heart, KeyRound, type LucideIcon } from "lucide-react";
import { Badge } from "@booking/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { useMe } from "../hooks";

type Tile = { href: string; icon: LucideIcon; title: string; body: string; soon?: boolean };

// Booking.com / Expedia-style account hub; `soon` tiles open placeholder pages (PLAN.md Phase 11)
const TILES: Tile[] = [
  { href: "/account/bookings", icon: CalendarCheck, title: "การจองของฉัน", body: "ดู ชำระเงิน หรือยกเลิกการจอง และเขียนรีวิว" },
  { href: "/wishlist", icon: Heart, title: "รายการโปรด", body: "โรงแรมที่บันทึกไว้ แยกเป็นรายการตามทริป" },
  { href: "/account/security", icon: KeyRound, title: "โปรไฟล์และความปลอดภัย", body: "แก้ไขชื่อ เบอร์โทร และเปลี่ยนรหัสผ่าน" },
  { href: "/rewards", icon: Crown, title: "สมาชิกรางวัล", body: "แต้มสะสมและสิทธิพิเศษ" },
];

export function AccountDetails() {
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>สวัสดี, {user.name}</h1>
          </CardTitle>
          <CardDescription>ข้อมูลบัญชีของคุณ</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">ชื่อ</dt>
            <dd>{user.name}</dd>
            <dt className="text-muted-foreground">อีเมล</dt>
            <dd className="break-all">{user.email}</dd>
            <dt className="text-muted-foreground">เบอร์โทร</dt>
            <dd>{user.phone ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <nav aria-label="เมนูบัญชี">
        <ul className="grid gap-3 sm:grid-cols-2">
          {TILES.map(({ href, icon: Icon, title, body, soon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full items-center gap-3 rounded-xl border bg-card p-4 outline-none transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    {title}
                    {soon && <Badge variant="secondary">เร็ว ๆ นี้</Badge>}
                  </span>
                  <span className="block text-sm text-muted-foreground">{body}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
