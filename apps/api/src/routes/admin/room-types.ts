import { Router } from "express";
import {
  createRoomSchema,
  hotelIdParamsSchema,
  hotelStatusInputSchema,
  roomParamsSchema,
  roomTypeInputSchema,
  roomTypeParamsSchema,
  updateRoomSchema,
} from "@booking/shared";
import {
  addRoom,
  createRoomType,
  deleteRoomType,
  getRoomType,
  listRoomTypes,
  saveRoomType,
  setRoomTypeStatus,
  updateRoom,
} from "../../controllers/admin-room-type.controller";
import { validate } from "../../middleware/validate";
import { adminRatePeriodsRouter } from "./rate-periods";

/**
 * `/api/admin/hotels/:hotelId/room-types` — mounted behind `requireHotelAccess()` in `hotels.ts`, so
 * ADMIN and assigned STAFF can do everything here. Services 404 a room type/room outside the hotel.
 */
export const adminRoomTypesRouter = Router({ mergeParams: true });

adminRoomTypesRouter.get("/", validate({ params: hotelIdParamsSchema }), listRoomTypes);

adminRoomTypesRouter.post(
  "/",
  validate({ params: hotelIdParamsSchema, body: roomTypeInputSchema }),
  createRoomType,
);

adminRoomTypesRouter.get("/:roomTypeId", validate({ params: roomTypeParamsSchema }), getRoomType);

adminRoomTypesRouter.put(
  "/:roomTypeId",
  validate({ params: roomTypeParamsSchema, body: roomTypeInputSchema }),
  saveRoomType,
);

adminRoomTypesRouter.patch(
  "/:roomTypeId/status",
  validate({ params: roomTypeParamsSchema, body: hotelStatusInputSchema }),
  setRoomTypeStatus,
);

adminRoomTypesRouter.delete("/:roomTypeId", validate({ params: roomTypeParamsSchema }), deleteRoomType);

adminRoomTypesRouter.post(
  "/:roomTypeId/rooms",
  validate({ params: roomTypeParamsSchema, body: createRoomSchema }),
  addRoom,
);

adminRoomTypesRouter.use("/:roomTypeId/rate-periods", adminRatePeriodsRouter);

adminRoomTypesRouter.patch(
  "/:roomTypeId/rooms/:roomId",
  validate({ params: roomParamsSchema, body: updateRoomSchema }),
  updateRoom,
);
