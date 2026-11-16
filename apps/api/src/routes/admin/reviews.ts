import { Router } from "express";
import { adminReviewListQuerySchema, reviewIdParamsSchema, updateReviewVisibilitySchema } from "@booking/shared";
import { listReviews, updateReview } from "../../controllers/admin-review.controller";
import { validate } from "../../middleware/validate";

/**
 * `/api/admin/reviews` — across hotels, so hotel scope is enforced in `admin-review.service`
 * (staff: own hotels only; another hotel's review → 404, another hotel's `hotelId` filter → 403).
 */
export const adminReviewsRouter = Router();

adminReviewsRouter.get("/", validate({ query: adminReviewListQuerySchema }), listReviews);
adminReviewsRouter.patch(
  "/:reviewId",
  validate({ params: reviewIdParamsSchema, body: updateReviewVisibilitySchema }),
  updateReview,
);
