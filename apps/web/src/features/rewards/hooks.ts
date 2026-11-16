"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyRewards } from "./api";

export const rewardKeys = {
  all: ["rewards"] as const,
  me: () => [...rewardKeys.all, "me"] as const,
};

/** The balance moves with holds, cancels and check-outs, so it is refetched on every mount. */
export function useMyRewards(enabled = true) {
  return useQuery({ queryKey: rewardKeys.me(), queryFn: fetchMyRewards, enabled, staleTime: 0 });
}
