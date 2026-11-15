import { Router } from "express";
import {
  adminBookingListQuerySchema,
  bookingCodeParamsSchema,
  cancelBookingInputSchema,
  moveBookingRoomInputSchema,
} from "@booking/shared";
import {
  cancelBooking,
  checkIn,
  checkOut,
  getBooking,
  listBookings,
  listRoomOptions,
  moveRoom,
} from "../../controllers/admin-booking.controller";
import { validate } from "../../middleware/validate";

/**
 * `/api/admin/bookings` — across hotels, so hotel scope is enforced in `admin-booking.service`
 * (staff: own hotels only; another hotel's booking → 404, another hotel's `hotelId` filter → 403).
 */
export const adminBookingsRouter = Router();

const params = { params: bookingCodeParamsSchema };

adminBookingsRouter.get("/", validate({ query: adminBookingListQuerySchema }), listBookings);
adminBookingsRouter.get("/:code", validate(params), getBooking);
adminBookingsRouter.get("/:code/rooms", validate(params), listRoomOptions);
adminBookingsRouter.post("/:code/check-in", validate(params), checkIn);
adminBookingsRouter.post("/:code/check-out", validate(params), checkOut);
adminBookingsRouter.post("/:code/cancel", validate({ ...params, body: cancelBookingInputSchema }), cancelBooking);
adminBookingsRouter.put("/:code/room", validate({ ...params, body: moveBookingRoomInputSchema }), moveRoom);
