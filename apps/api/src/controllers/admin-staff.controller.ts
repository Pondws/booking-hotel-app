import type {
  AdminStaffListQuery,
  AssignStaffHotelInput,
  CreateStaffData,
  ResetStaffPasswordInput,
  SetStaffActiveInput,
  StaffHotelParams,
  StaffIdParams,
  UpdateStaffData,
} from "@booking/shared";
import type { Request, Response } from "express";
import { noContent, ok } from "../lib/http";
import * as staffService from "../services/admin-staff.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; query and params into res.locals.
type Body<T> = Request<Record<string, string>, unknown, T>;
type StaffRes = Response<unknown, { params: StaffIdParams }>;

export async function listStaff(_req: Request, res: Response<unknown, { query: AdminStaffListQuery }>) {
  ok(res, await staffService.listStaff(res.locals.query));
}

export async function getStaff(_req: Request, res: StaffRes) {
  ok(res, await staffService.getStaff(res.locals.params.userId));
}

export async function createStaff(req: Body<CreateStaffData>, res: Response) {
  ok(res, await staffService.createStaff(currentUser(req), req.body), 201);
}

export async function updateStaff(req: Body<UpdateStaffData>, res: StaffRes) {
  ok(res, await staffService.updateStaff(currentUser(req), res.locals.params.userId, req.body));
}

export async function assignStaffHotel(req: Body<AssignStaffHotelInput>, res: StaffRes) {
  ok(res, await staffService.assignHotel(currentUser(req), res.locals.params.userId, req.body.hotelId), 201);
}

export async function removeStaffHotel(req: Request, res: Response<unknown, { params: StaffHotelParams }>) {
  const { userId, hotelId } = res.locals.params;
  await staffService.removeHotel(currentUser(req), userId, hotelId);
  noContent(res);
}

export async function setStaffActive(req: Body<SetStaffActiveInput>, res: StaffRes) {
  ok(res, await staffService.setStaffActive(currentUser(req), res.locals.params.userId, req.body.isActive));
}

export async function resetStaffPassword(req: Body<ResetStaffPasswordInput>, res: StaffRes) {
  await staffService.resetStaffPassword(currentUser(req), res.locals.params.userId, req.body.password);
  noContent(res);
}
