import { Router } from "express";
import {
  adminStaffListQuerySchema,
  assignStaffHotelSchema,
  createStaffSchema,
  staffHotelParamsSchema,
  staffIdParamsSchema,
  updateStaffSchema,
} from "@booking/shared";
import {
  assignStaffHotel,
  createStaff,
  getStaff,
  listStaff,
  removeStaffHotel,
  updateStaff,
} from "../../controllers/admin-staff.controller";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";

/** `/api/admin/staff` — ADMIN only. */
export const adminStaffRouter = Router();

adminStaffRouter.use(requireRole("ADMIN"));

adminStaffRouter.get("/", validate({ query: adminStaffListQuerySchema }), listStaff);
adminStaffRouter.post("/", validate({ body: createStaffSchema }), createStaff);
adminStaffRouter.get("/:userId", validate({ params: staffIdParamsSchema }), getStaff);
adminStaffRouter.patch(
  "/:userId",
  validate({ params: staffIdParamsSchema, body: updateStaffSchema }),
  updateStaff,
);
adminStaffRouter.post(
  "/:userId/hotels",
  validate({ params: staffIdParamsSchema, body: assignStaffHotelSchema }),
  assignStaffHotel,
);
adminStaffRouter.delete(
  "/:userId/hotels/:hotelId",
  validate({ params: staffHotelParamsSchema }),
  removeStaffHotel,
);
