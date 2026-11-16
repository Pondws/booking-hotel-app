import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { Badge } from "@booking/ui/components/badge";
import { buttonVariants } from "@booking/ui/components/button";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** What the finished page will do (shown as a checklist). */
  planned: readonly string[];
  /** Page sections that can be linked to (`/help#payment`) even before the page exists. */
  anchors?: readonly { id: string; title: string; body: string }[];
};

/** Placeholder for a customer feature that's planned but not built yet (PLAN.md Phase 11). */
export function ComingSoon({ icon: Icon, title, description, planned, anchors = [] }: Props) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12">
      <header className="space-y-4 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Icon aria-hidden className="size-7" />
        </span>
        <Badge variant="secondary">เร็ว ๆ นี้</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mx-auto max-w-prose text-muted-foreground">{description}</p>
      </header>

      <section aria-labelledby="planned-heading" className="space-y-3 rounded-xl border bg-card p-6">
        <h2 id="planned-heading" className="text-lg font-semibold">
          สิ่งที่กำลังจะมี
        </h2>
        <ul className="space-y-2 text-sm">
          {planned.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {anchors.map((a) => (
        <section key={a.id} id={a.id} aria-labelledby={`${a.id}-heading`} className="scroll-mt-24 space-y-2">
          <h2 id={`${a.id}-heading`} className="text-lg font-semibold">
            {a.title}
          </h2>
          <p className="text-sm text-muted-foreground">{a.body}</p>
        </section>
      ))}

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/hotels" className={buttonVariants()}>
          ค้นหาที่พัก
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
