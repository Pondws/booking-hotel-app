"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { FAQ, searchFaq } from "../faq";

/** Searchable FAQ (client-side — the content is static). Section ids stay as link targets. */
export function HelpCenter() {
  const [query, setQuery] = useState("");
  const sections = searchFaq(FAQ, query);
  const searching = query.trim() !== "";
  const count = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <label htmlFor="faq-search" className="sr-only">
          ค้นหาคำถาม
        </label>
        <div className="relative">
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="faq-search"
            type="search"
            className="pl-9"
            placeholder="ค้นหา เช่น ยกเลิก, คืนเงิน, แต้ม"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {searching && (
          <p role="status" className="text-sm text-muted-foreground">
            {count > 0 ? `พบ ${count} คำถาม` : "ไม่พบคำถามที่ตรงกัน"}
          </p>
        )}
      </div>

      {!searching && (
        <nav aria-label="หมวดคำถาม" className="flex flex-wrap gap-2">
          {FAQ.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">
              {s.title}
            </a>
          ))}
        </nav>
      )}

      {sections.length === 0 ? (
        <div className="space-y-3 rounded-xl border p-6 text-center">
          <p className="text-sm text-muted-foreground">ลองใช้คำอื่น หรือส่งคำถามถึงทีมงานจากหน้าการจองของคุณ</p>
          <Button variant="outline" onClick={() => setQuery("")}>
            ล้างคำค้นหา
          </Button>
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="scroll-mt-24 space-y-3">
            <h2 id={`${s.id}-heading`} className="text-lg font-semibold">
              {s.title}
            </h2>
            <ul className="divide-y rounded-xl border">
              {s.items.map((item) => (
                <li key={item.q}>
                  <details className="group" open={searching}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section aria-labelledby="contact-heading" className="space-y-2 rounded-xl border bg-card p-6">
        <h2 id="contact-heading" className="text-lg font-semibold">
          ยังไม่ได้คำตอบ?
        </h2>
        <p className="text-sm text-muted-foreground">
          ส่งข้อความถึงทีมงานได้จากหน้ารายละเอียดการจอง ทีมงานของโรงแรมจะเห็นข้อมูลการจองของคุณและตอบกลับในหน้าเดียวกัน
        </p>
        <Button asChild variant="outline">
          <Link href="/account/bookings">ไปที่การจองของฉัน</Link>
        </Button>
      </section>
    </div>
  );
}
