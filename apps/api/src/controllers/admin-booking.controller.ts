import type { AdminBookingListQuery, BookingCodeParams, CancelBookingData, MoveBookingRoomInput } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as adminBookingService from "../services/admin-booking.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; query and params into res.locals.
type Body<T> = Request<Record<string, string>, unknown, T>;
type CodeRes = Response<unknown, { params: BookingCodeParams }>;

export async function listBookings(req: Request, res: Response<unknown, { query: AdminBookingListQuery }>) {
  ok(res, await adminBookingService.listAdminBookings(currentUser(req), res.locals.query));
}

export async function getBooking(req: Request, res: CodeRes) {
  ok(res, await adminBookingService.getAdminBooking(currentUser(req), res.locals.params.code));
}

export async function listRoomOptions(req: Request, res: CodeRes) {
  ok(res, await adminBookingService.listBookingRoomOptions(currentUser(req), res.locals.params.code));
}

export async function checkIn(req: Request, res: CodeRes) {
  ok(res, await adminBookingService.checkInBooking(currentUser(req), res.locals.params.code));
}

export async function checkOut(req: Request, res: CodeRes) {
  ok(res, await adminBookingService.checkOutBooking(currentUser(req), res.locals.params.code));
}

export async function cancelBooking(req: Body<CancelBookingData>, res: CodeRes) {
  ok(res, await adminBookingService.cancelAdminBooking(currentUser(req), res.locals.params.code, req.body.reason));
}

export async function moveRoom(req: Body<MoveBookingRoomInput>, res: CodeRes) {
  ok(res, await adminBookingService.moveBookingRoom(currentUser(req), res.locals.params.code, req.body.roomId));
}
