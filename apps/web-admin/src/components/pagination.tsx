import Link from "next/link";
import { Button } from "@booking/ui/components/button";

type Props = {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  label?: string;
};

/** Previous / Next links with "Page x of y" — same pattern as the customer site. */
export function Pagination({ page, totalPages, hrefFor, label = "หน้าผลลัพธ์" }: Props) {
  if (totalPages <= 1 && page <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4">
      {hasPrev ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(Math.min(page - 1, totalPages))} rel="prev">
            ก่อนหน้า
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
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
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          ถัดไป
        </Button>
      )}
    </nav>
  );
}
