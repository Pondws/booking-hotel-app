"use client"

import * as React from "react"
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
  className?: string
}

/**
 * Column-driven table for data views. Loading / error / empty states stay with the caller
 * (their copy differs per view); pair with `DataTableSkeleton` for the first load.
 */
function DataTable<T>({ columns, rows, getRowKey, caption, busy = false, className }: DataTableProps<T>) {
  return (
    <div
      data-slot="data-table"
      aria-busy={busy}
      className={cn("rounded-lg border", busy && "opacity-60", className)}
    >
      <Table>
        {caption && <TableCaption className="sr-only">{caption}</TableCaption>}
        <TableHeader>
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
