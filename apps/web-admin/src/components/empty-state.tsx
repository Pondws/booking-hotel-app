import Link from "next/link";
import { Button } from "@booking/ui/components/button";

type Props = {
  message: string;
  /** Link that resets the filters/search — pass only when something is filtered. */
  clearHref?: string;
  clearLabel?: string;
};

/** Empty-state copy for a `DataTable`'s `empty` row: what happened + how to fix it (DESIGN.md "Empty"). */
export function EmptyState({ message, clearHref, clearLabel = "ล้างตัวกรอง" }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm text-muted-foreground">{message}</p>
      {clearHref !== undefined && (
        <Button asChild variant="link" size="sm">
          <Link href={clearHref}>{clearLabel}</Link>
        </Button>
      )}
    </div>
  );
}
