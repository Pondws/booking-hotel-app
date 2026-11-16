import { rewardsSummarySchema, type RewardsSummary } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchMyRewards(): Promise<RewardsSummary> {
  return request(rewardsSummarySchema, { method: "GET", url: "/api/rewards/me" });
}
