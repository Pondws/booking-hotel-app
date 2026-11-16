import { Router } from "express";
import { wishlistIdParamsSchema, wishlistInputSchema, wishlistItemParamsSchema } from "@booking/shared";
import { addHotel, create, getOne, list, remove, removeHotel, rename } from "../controllers/wishlist.controller";
import { loadSession } from "../middleware/load-session";
import { requireAuth } from "../middleware/require-auth";
import { validate } from "../middleware/validate";

/** `/api/wishlists` — the signed-in customer's own lists (web session). */
export const wishlistsRouter = Router();

wishlistsRouter.use(loadSession("WEB"), requireAuth);

wishlistsRouter.get("/", list);
wishlistsRouter.post("/", validate({ body: wishlistInputSchema }), create);
wishlistsRouter.get("/:wishlistId", validate({ params: wishlistIdParamsSchema }), getOne);
wishlistsRouter.patch("/:wishlistId", validate({ params: wishlistIdParamsSchema, body: wishlistInputSchema }), rename);
wishlistsRouter.delete("/:wishlistId", validate({ params: wishlistIdParamsSchema }), remove);
// PUT/DELETE are idempotent: saving twice or removing a missing hotel is fine.
wishlistsRouter.put("/:wishlistId/hotels/:hotelId", validate({ params: wishlistItemParamsSchema }), addHotel);
wishlistsRouter.delete("/:wishlistId/hotels/:hotelId", validate({ params: wishlistItemParamsSchema }), removeHotel);
