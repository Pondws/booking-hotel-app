import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@booking/ui/components/button";

type Props = {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  label?: string;
};

export function Pagination({ page, totalPages, hrefFor, label = "หน้าผลการค้นหา" }: Props) {
  if (totalPages <= 1 && page <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4">
      {hasPrev ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(Math.min(page - 1, totalPages))} rel="prev">
            <ChevronLeft aria-hidden className="size-4" />
            ก่อนหน้า
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft aria-hidden className="size-4" />
          ก่อนหน้า
        </Button>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        หน้า {page} จาก {totalPages}
      </p>
      {hasNext ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page + 1)} rel="next">
            ถัดไป
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          ถัดไป
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      )}
    </nav>
  );
}
