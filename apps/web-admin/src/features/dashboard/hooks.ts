"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AdminDashboardQuery } from "@booking/shared";
import { fetchAdminDashboard } from "./api";

export const adminDashboardKeys = {
  all: ["admin-dashboard"] as const,
  detail: (query: AdminDashboardQuery) => [...adminDashboardKeys.all, query] as const,
};

/** Keeps the previous numbers on screen while a new hotel / range loads. */
export function useAdminDashboard(query: AdminDashboardQuery) {
  return useQuery({
    queryKey: adminDashboardKeys.detail(query),
    queryFn: () => fetchAdminDashboard(query),
    placeholderData: keepPreviousData,
  });
}
