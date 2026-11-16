"use client";

import Link from "next/link";
import { useId } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import { SelectField, type SelectOption } from "@booking/ui/components/select-field";
import { cn } from "@booking/ui/lib/utils";

/** Rows-per-page choices; every admin list query accepts `pageSize` up to 50. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type Props = {
  page: number;
  totalPages: number;
  /** Total rows across all pages. */
  total: number;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  label?: string;
} & (
  | {
      /** Server-paged lists: page lives in the URL, so each step is a link. */
      hrefFor: (page: number) => string;
      onPageChange?: never;
    }
  | {
      /** Client-paged lists (`useClientPagination`): page lives in component state. */
      onPageChange: (page: number) => void;
      hrefFor?: never;
    }
);

type PageItem = number | `gap-${number}`;

/** 1 … 4 5 6 … 10 — first, last, and the current page ±1; a single hidden page is shown instead of "…". */
function pageItems(page: number, totalPages: number): PageItem[] {
  const shown = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];
  let prev = 0;
  for (const p of shown) {
    if (p - prev === 2) items.push(prev + 1);
    else if (p - prev > 2) items.push(`gap-${p}`);
    items.push(p);
    prev = p;
  }
  return items;
}

/** Table footer: "Showing x–y of N", rows per page, and ‹ 1 2 3 › — the current page is the bordered white one. */
export function Pagination({
  page,
  totalPages: rawTotal,
  total,
  pageSize,
  onPageSizeChange,
  hrefFor,
  onPageChange,
  label = "หน้าผลลัพธ์",
}: Props) {
  const totalPages = Math.max(1, rawTotal);
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  const sizeOptions: SelectOption[] = [...new Set([...PAGE_SIZE_OPTIONS, pageSize])]
    .sort((a, b) => a - b)
    .map((n) => ({ value: String(n), label: String(n) }));
  const step = { hrefFor, onPageChange };
  const sizeLabelId = useId();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <p aria-live="polite" className="tabular-nums">
          แสดง {from}–{to} จาก {total} รายการ
        </p>
        <div className="flex items-center gap-2">
          <span id={sizeLabelId}>แถวต่อหน้า</span>
          <SelectField
            aria-describedby={sizeLabelId}
            className="h-8 w-18"
            options={sizeOptions}
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          />
        </div>
      </div>

      <nav aria-label={label}>
        <ul className="flex items-center gap-1">
          <li>
            <Step {...step} target={current - 1} disabled={current <= 1} aria-label="หน้าก่อนหน้า" rel="prev">
              <ChevronLeft className="size-4" aria-hidden />
            </Step>
          </li>
          {pageItems(current, totalPages).map((item) =>
            typeof item === "number" ? (
              <li key={item}>
                <Step
                  {...step}
                  target={item}
                  active={item === current}
                  aria-label={`หน้า ${item}`}
                >
                  {item}
                </Step>
              </li>
            ) : (
              <li key={item} aria-hidden className="flex size-8 items-center justify-center text-muted-foreground">
                <MoreHorizontal className="size-4" />
              </li>
            ),
          )}
          <li>
            <Step
              {...step}
              target={current + 1}
              disabled={current >= totalPages}
              aria-label="หน้าถัดไป"
              rel="next"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Step>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function Step({
  target,
  disabled = false,
  active = false,
  rel,
  hrefFor,
  onPageChange,
  children,
  "aria-label": ariaLabel,
}: {
  target: number;
  disabled?: boolean;
  active?: boolean;
  rel?: "prev" | "next";
  hrefFor?: (page: number) => string;
  onPageChange?: (page: number) => void;
  children: React.ReactNode;
  "aria-label": string;
}) {
  const common = {
    variant: active ? "outline" : "ghost",
    size: "icon-sm",
    className: cn("tabular-nums", active && "pointer-events-none font-semibold"),
    "aria-label": ariaLabel,
    "aria-current": active ? ("page" as const) : undefined,
  } as const;

  if (disabled) {
    return (
      <Button {...common} disabled>
        {children}
      </Button>
    );
  }
  if (hrefFor) {
    return (
      <Button asChild {...common}>
        <Link href={hrefFor(target)} rel={rel}>
          {children}
        </Link>
      </Button>
    );
  }
  return (
    <Button type="button" {...common} onClick={() => onPageChange?.(target)}>
      {children}
    </Button>
  );
}
