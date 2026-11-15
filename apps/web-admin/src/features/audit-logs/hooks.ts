"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { AuditEntityType } from "@booking/shared";
import { fetchAuditLogs } from "./api";

/** Whose history: one entity (`entityId`, plus its children's rows), or every row of an entity type. */
export type HistoryFilter = { entityType: AuditEntityType; entityId?: string };

const PAGE_SIZE = 10;

/** Every admin write adds a row, so `providers.tsx` invalidates `all` after any successful mutation. */
export const adminAuditLogKeys = {
  all: ["admin-audit-logs"] as const,
  history: (filter: HistoryFilter) => [...adminAuditLogKeys.all, "history", filter] as const,
};

/** Newest first, 10 at a time ("ดูเพิ่มเติม" loads the next page). */
export function useHistory(filter: HistoryFilter) {
  return useInfiniteQuery({
    queryKey: adminAuditLogKeys.history(filter),
    queryFn: ({ pageParam }) => fetchAuditLogs({ ...filter, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
