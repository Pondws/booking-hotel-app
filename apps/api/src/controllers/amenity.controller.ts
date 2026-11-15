import type {
  AmenityIdParams,
  AmenityListQuery,
  CreateAmenityData,
  UpdateAmenityData,
} from "@booking/shared";
import type { Request, Response } from "express";
import { noContent, ok } from "../lib/http";
import * as amenityService from "../services/amenity.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; query and params into res.locals.
type Body<T> = Request<Record<string, string>, unknown, T>;
type AmenityRes = Response<unknown, { params: AmenityIdParams }>;

export async function listAmenities(_req: Request, res: Response<unknown, { query: AmenityListQuery }>) {
  ok(res, await amenityService.listAmenities(res.locals.query.scope));
}

export async function getAmenity(_req: Request, res: AmenityRes) {
  ok(res, await amenityService.getAmenity(res.locals.params.amenityId));
}

export async function createAmenity(req: Body<CreateAmenityData>, res: Response) {
  ok(res, await amenityService.createAmenity(currentUser(req), req.body), 201);
}

export async function updateAmenity(req: Body<UpdateAmenityData>, res: AmenityRes) {
  ok(res, await amenityService.updateAmenity(currentUser(req), res.locals.params.amenityId, req.body));
}

export async function deleteAmenity(req: Request, res: AmenityRes) {
  await amenityService.deleteAmenity(currentUser(req), res.locals.params.amenityId);
  noContent(res);
}
