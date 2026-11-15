import express, { Router } from "express";
import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_TYPES } from "@booking/shared";
import { uploadImage } from "../../controllers/upload.controller";

export const adminUploadsRouter = Router();

// Body = the raw file (one file per request; the client sends several requests for a multi-select).
// Other Content-Types skip the parser and are rejected by the service. Too large → 413.
adminUploadsRouter.post(
  "/images",
  express.raw({ type: [...IMAGE_UPLOAD_TYPES], limit: IMAGE_UPLOAD_MAX_BYTES }),
  uploadImage,
);
