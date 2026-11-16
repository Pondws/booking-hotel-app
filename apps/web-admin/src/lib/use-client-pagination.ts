import { useState } from "react";

export const CLIENT_PAGE_SIZE = 10;

/**
 * Pages a list the API returns whole (amenities, room types, rate periods) — pair with
 * `<Pagination onPageChange={setPage} />` and `DataTable rows={pageRows}`. The page is clamped
 * to the last one, so deleting the last row of a page (or a smaller refetch) never shows an empty page.
 */
export function useClientPagination<T>(rows: readonly T[] | undefined, initialPageSize = CLIENT_PAGE_SIZE) {
  const [requested, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const total = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requested), totalPages);
  const pageRows = rows ? rows.slice((page - 1) * pageSize, page * pageSize) : [];
  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };
  /** Spread onto `<Pagination>`. */
  const paginationProps = { page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize };
  return { pageRows, setPage, paginationProps };
}
