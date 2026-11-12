import Link from "next/link";
import { Button } from "@booking/ui/components/button";

type Props = {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
};

export function Pagination({ page, totalPages, hrefFor }: Props) {
  if (totalPages <= 1 && page <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="Results pages" className="flex items-center justify-between gap-4">
      {hasPrev ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(Math.min(page - 1, totalPages))} rel="prev">
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Previous
        </Button>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </p>
      {hasNext ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page + 1)} rel="next">
            Next
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next
        </Button>
      )}
    </nav>
  );
}
