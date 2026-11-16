import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@booking/ui/components/badge";
import { cn } from "@booking/ui/lib/utils";

// Filters + sort aren't built yet (PLAN.md Phase 11): the panel shows what's coming instead of dead controls
const PLANNED = ["ช่วงราคาต่อคืน", "คะแนนรีวิว", "สิ่งอำนวยความสะดวก", "เรียงตามราคา / คะแนน", "ดูบนแผนที่"] as const;

export function FilterPanel({ className }: { className?: string }) {
  return (
    <aside aria-labelledby="filters-heading" className={cn("space-y-3 rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="filters-heading" className="flex items-center gap-2 font-semibold">
          <SlidersHorizontal aria-hidden className="size-4" />
          ตัวกรอง
        </h2>
        <Badge variant="secondary">เร็ว ๆ นี้</Badge>
      </div>
      <p className="text-sm text-muted-foreground">ตอนนี้ค้นหาได้ตามเมือง วันที่ และจำนวนผู้เข้าพัก เร็ว ๆ นี้จะกรองได้อีกตาม:</p>
      <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1.5">
        {PLANNED.map((item) => (
          <li key={item} className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
}
