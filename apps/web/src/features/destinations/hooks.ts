"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDestinations } from "./api";

export const destinationKeys = {
  all: ["destinations"] as const,
  list: () => [...destinationKeys.all, "list"] as const,
};

/** Cities change only when hotels are added or (de)activated, so a few minutes of staleness is fine. */
export function useDestinations() {
  return useQuery({ queryKey: destinationKeys.list(), queryFn: fetchDestinations, staleTime: 5 * 60_000 });
}
