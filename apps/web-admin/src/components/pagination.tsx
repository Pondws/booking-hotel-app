import Link from "next/link";
import { Button } from "@booking/ui/components/button";

type Props = {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  label?: string;
};

/** Previous / Next links with "Page x of y" — same pattern as the customer site. */
export function Pagination({ page, totalPages, hrefFor, label = "Results pages" }: Props) {
  if (totalPages <= 1 && page <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4">
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
