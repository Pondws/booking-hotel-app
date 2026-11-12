import type { CreateHotelData } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as hotelService from "../services/hotel.service";

export async function listHotels(_req: Request, res: Response) {
  ok(res, await hotelService.listActiveHotels());
}

// Body is already parsed by validate().
export async function createHotel(
  req: Request<Record<string, string>, unknown, CreateHotelData>,
  res: Response,
) {
  ok(res, await hotelService.createHotel(req.body), 201);
}
