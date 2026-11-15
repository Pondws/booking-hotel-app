import type {
  CreateRoomInput,
  HotelIdParams,
  HotelStatusInput,
  RoomParams,
  RoomTypeData,
  RoomTypeParams,
  UpdateRoomData,
} from "@booking/shared";
import type { Request, Response } from "express";
import { noContent, ok } from "../lib/http";
import * as roomTypeService from "../services/admin-room-type.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; params into res.locals.params.
type Body<T> = Request<Record<string, string>, unknown, T>;

export async function listRoomTypes(_req: Request, res: Response<unknown, { params: HotelIdParams }>) {
  ok(res, await roomTypeService.listRoomTypes(res.locals.params.hotelId));
}

export async function getRoomType(_req: Request, res: Response<unknown, { params: RoomTypeParams }>) {
  const { hotelId, roomTypeId } = res.locals.params;
  ok(res, await roomTypeService.getRoomType(hotelId, roomTypeId));
}

export async function createRoomType(
  req: Body<RoomTypeData>,
  res: Response<unknown, { params: HotelIdParams }>,
) {
  ok(res, await roomTypeService.createRoomType(currentUser(req), res.locals.params.hotelId, req.body), 201);
}

export async function saveRoomType(
  req: Body<RoomTypeData>,
  res: Response<unknown, { params: RoomTypeParams }>,
) {
  const { hotelId, roomTypeId } = res.locals.params;
  ok(res, await roomTypeService.saveRoomType(currentUser(req), hotelId, roomTypeId, req.body));
}

export async function setRoomTypeStatus(
  req: Body<HotelStatusInput>,
  res: Response<unknown, { params: RoomTypeParams }>,
) {
  const { hotelId, roomTypeId } = res.locals.params;
  ok(res, await roomTypeService.setRoomTypeStatus(currentUser(req), hotelId, roomTypeId, req.body.isActive));
}

export async function deleteRoomType(req: Request, res: Response<unknown, { params: RoomTypeParams }>) {
  const { hotelId, roomTypeId } = res.locals.params;
  await roomTypeService.deleteRoomType(currentUser(req), hotelId, roomTypeId);
  noContent(res);
}

export async function addRoom(
  req: Body<CreateRoomInput>,
  res: Response<unknown, { params: RoomTypeParams }>,
) {
  const { hotelId, roomTypeId } = res.locals.params;
  ok(res, await roomTypeService.addRoom(currentUser(req), hotelId, roomTypeId, req.body.number), 201);
}

export async function updateRoom(req: Body<UpdateRoomData>, res: Response<unknown, { params: RoomParams }>) {
  const { hotelId, roomTypeId, roomId } = res.locals.params;
  ok(res, await roomTypeService.updateRoom(currentUser(req), hotelId, roomTypeId, roomId, req.body));
}
