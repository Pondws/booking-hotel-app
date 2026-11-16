"use client"

import * as React from "react"
import { Inbox } from "lucide-react"
import { cn } from "@booking/ui/lib/utils"
import { Skeleton } from "@booking/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@booking/ui/components/table"

export type DataTableColumn<T> = {
  /** Stable key for the column (React key). */
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Applied to both the header and the body cells of this column. */
  className?: string
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  /** Screen-reader caption describing the table (e.g. "Hotels"). */
  caption?: string
  /** Refetching with previous rows visible: dims the table and sets `aria-busy` (DESIGN.md "Refetching"). */
  busy?: boolean
  /** Shown under the header (centered, with `emptyIcon`) when `rows` is empty. */
  empty?: React.ReactNode
  /** Icon above `empty` (default: an inbox), e.g. a search-x icon for "no results for these filters". */
  emptyIcon?: React.ReactNode
  /** Footer slot under the rows (e.g. the app's `Pagination`); not shown while `rows` is empty. */
  pagination?: React.ReactNode
  /**
   * Full-page list: the table takes the remaining height of a flex-column parent, only the rows
   * scroll (header stays put) and `pagination` sits at the bottom. The parent chain must be
   * height-bounded (e.g. the page's `<main className="md:h-screen …">`).
   */
  fill?: boolean
  className?: string
}

/**
 * Column-driven table for data views. Loading / error states stay with the caller; pass the
 * empty-state copy as `empty` (it differs per view). Pair with `DataTableSkeleton` for the first load.
 */
function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  busy = false,
  empty,
  pagination,
  emptyIcon,
  fill = false,
  className,
}: DataTableProps<T>) {
  const isEmpty = rows.length === 0
  return (
    <div
      data-slot="data-table"
      aria-busy={busy}
      className={cn(
        "rounded-lg border bg-card",
        // the Table's own container becomes the bounded scroll area (still scrollable, scrollbar hidden)
        fill &&
          "flex min-h-0 flex-1 flex-col overflow-hidden [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1 [&>[data-slot=table-container]]:overflow-auto [&>[data-slot=table-container]]:[scrollbar-width:none] [&>[data-slot=table-container]::-webkit-scrollbar]:hidden",
        // header only — the empty block below takes the rest
        fill && isEmpty && "[&>[data-slot=table-container]]:flex-none",
        busy && "opacity-60",
        className
      )}
    >
      <Table>
        {caption && <TableCaption className="sr-only">{caption}</TableCaption>}
        <TableHeader
          className={cn(
            fill &&
              // borders of a sticky row scroll away under border-collapse, so draw the line as a shadow
              "sticky top-0 z-10 bg-card [&_th]:shadow-[inset_0_-1px_0_var(--color-border)] [&_tr]:border-b-0"
          )}
        >
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.id} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {isEmpty && (
        // outside <table> so it can take (and center in) all the space under the header
        <div
          data-slot="data-table-empty"
          className={cn(
            "flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-sm text-muted-foreground",
            fill && "flex-1"
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted" aria-hidden>
            {emptyIcon ?? <Inbox className="size-6" />}
          </div>
          {empty}
        </div>
      )}
      {pagination && !isEmpty && (
        <div data-slot="data-table-pagination" className="shrink-0 border-t p-2">
          {pagination}
        </div>
      )}
    </div>
  )
}

/** First-load placeholder shaped like a `DataTable` (header + `rows` lines). */
function DataTableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div data-slot="data-table-skeleton" aria-hidden className={cn("space-y-2", className)}>
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export { DataTable, DataTableSkeleton }
