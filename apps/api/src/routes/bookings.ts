import {
  bookingCodeParamsSchema,
  bookingListQuerySchema,
  createBookingSchema,
  createReviewSchema,
  createSupportRequestSchema,
} from "@booking/shared";
import { Router } from "express";
import { cancel, create, getOne, listMine, review } from "../controllers/booking.controller";
import { start as startPayment, sync as syncPayment } from "../controllers/payment.controller";
import { create as createSupport, listMine as listSupport } from "../controllers/support.controller";
import { loadSession } from "../middleware/load-session";
import { requireAuth } from "../middleware/require-auth";
import { validate } from "../middleware/validate";

export const bookingsRouter = Router();

bookingsRouter.use(loadSession("WEB"), requireAuth);

bookingsRouter.post("/", validate({ body: createBookingSchema }), create);
// Registered before /:code (`me` also fails the code pattern).
bookingsRouter.get("/me", validate({ query: bookingListQuerySchema }), listMine);
bookingsRouter.get("/:code", validate({ params: bookingCodeParamsSchema }), getOne);
bookingsRouter.post("/:code/cancel", validate({ params: bookingCodeParamsSchema }), cancel);
bookingsRouter.post(
  "/:code/review",
  validate({ params: bookingCodeParamsSchema, body: createReviewSchema }),
  review,
);
bookingsRouter.post("/:code/payments",validate({ params: bookingCodeParamsSchema }), startPayment);
bookingsRouter.get("/:code/support-requests", validate({ params: bookingCodeParamsSchema }), listSupport);
bookingsRouter.post(
  "/:code/support-requests",
  validate({ params: bookingCodeParamsSchema, body: createSupportRequestSchema }),
  createSupport,
);
bookingsRouter.post("/:code/payments/sync", validate({ params: bookingCodeParamsSchema }), syncPayment);
