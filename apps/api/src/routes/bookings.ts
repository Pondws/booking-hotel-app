import {
  bookingCodeParamsSchema,
  bookingListQuerySchema,
  createBookingSchema,
  createReviewSchema,
} from "@booking/shared";
import { Router } from "express";
import { cancel, create, getOne, listMine, review } from "../controllers/booking.controller";
import { start as startPayment, sync as syncPayment } from "../controllers/payment.controller";
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
bookingsRouter.post("/:code/payments/sync", validate({ params: bookingCodeParamsSchema }), syncPayment);
