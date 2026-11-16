"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDeals } from "./api";

export const dealKeys = {
  all: ["deals"] as const,
  list: () => [...dealKeys.all, "list"] as const,
};

/** Deals change only when staff edit them; the real price is always re-quoted on the hotel page. */
export function useDeals() {
  return useQuery({ queryKey: dealKeys.list(), queryFn: fetchDeals, staleTime: 5 * 60_000 });
}
