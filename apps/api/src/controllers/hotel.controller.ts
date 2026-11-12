import type { CreateHotelData } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as hotelService from "../services/hotel.service";

export async function listHotels(_req: Request, res: Response) {
  ok(res, await hotelService.listActiveHotels());
}

export async function createHotel(req: Request, res: Response) {
  const input = req.body as CreateHotelData; // parsed by validate()
  ok(res, await hotelService.createHotel(input), 201);
}
