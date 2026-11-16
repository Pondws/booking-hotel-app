import { Router } from "express";
import {
  adminSupportListQuerySchema,
  resolveSupportRequestSchema,
  supportRequestIdParamsSchema,
} from "@booking/shared";
import { listAdmin, resolve } from "../../controllers/support.controller";
import { validate } from "../../middleware/validate";

/** `/api/admin/support-requests` — STAFF see their hotels' requests (scoped in the service), ADMIN all. */
export const adminSupportRouter = Router();

adminSupportRouter.get("/", validate({ query: adminSupportListQuerySchema }), listAdmin);
adminSupportRouter.post(
  "/:requestId/resolve",
  validate({ params: supportRequestIdParamsSchema, body: resolveSupportRequestSchema }),
  resolve,
);
