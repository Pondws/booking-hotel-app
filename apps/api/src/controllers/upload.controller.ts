import type { UploadedImage } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as uploadService from "../services/upload.service";

export async function uploadImage(req: Request, res: Response) {
  const fileName = await uploadService.saveImage(req.body, req.get("content-type"));
  const data: UploadedImage = { url: `${req.protocol}://${req.get("host")}/uploads/${fileName}` };
  ok(res, data, 201);
}
