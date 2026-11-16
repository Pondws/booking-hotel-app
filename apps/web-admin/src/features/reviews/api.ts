import {
  adminReviewListSchema,
  adminReviewSchema,
  type AdminReviewListQuery,
  type UpdateReviewVisibilityInput,
} from "@booking/shared";
import { request } from "@/lib/api";

export function fetchAdminReviews(query: AdminReviewListQuery) {
  return request(adminReviewListSchema, { method: "GET", url: "/api/admin/reviews", params: query });
}

export function updateReviewVisibility(id: string, input: UpdateReviewVisibilityInput) {
  return request(adminReviewSchema, {
    method: "PATCH",
    url: `/api/admin/reviews/${encodeURIComponent(id)}`,
    data: input,
  });
}
