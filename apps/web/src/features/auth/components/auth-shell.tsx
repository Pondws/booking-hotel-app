import type { ReactNode } from "react";
import { BadgeCheck, CalendarX2, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";

const PERKS = [
  { icon: Tag, text: "เห็นราคารวมจริงก่อนจองทุกครั้ง" },
  { icon: CalendarX2, text: "ยกเลิกได้ก่อนวันเช็คอิน คืนเงินเต็มจำนวน" },
  { icon: BadgeCheck, text: "ดูและจัดการการจองทั้งหมดได้ในที่เดียว" },
] as const;

type Props = { title: string; description: string; children: ReactNode };

/** Login / register: the form card beside a short list of member perks (stacked on phones). */
export function AuthShell({ title, description, children }: Props) {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center">
      <section aria-label="สิทธิประโยชน์สมาชิก" className="order-last space-y-4 md:order-first">
        <h2 className="text-2xl font-semibold tracking-tight">จองง่ายขึ้นเมื่อเป็นสมาชิก</h2>
        <ul className="space-y-3">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon aria-hidden className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>
      <Card className="rounded-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
