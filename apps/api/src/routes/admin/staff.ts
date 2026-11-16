import { Router } from "express";
import {
  adminStaffListQuerySchema,
  assignStaffHotelSchema,
  createStaffSchema,
  resetStaffPasswordSchema,
  setStaffActiveSchema,
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
  resetStaffPassword,
  setStaffActive,
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
adminStaffRouter.patch(
  "/:userId/status",
  validate({ params: staffIdParamsSchema, body: setStaffActiveSchema }),
  setStaffActive,
);
adminStaffRouter.post(
  "/:userId/password",
  validate({ params: staffIdParamsSchema, body: resetStaffPasswordSchema }),
  resetStaffPassword,
);
