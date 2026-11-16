import type { WishlistInput, WishlistItemParams } from "@booking/shared";
import type { Request, Response } from "express";
import { noContent, ok } from "../lib/http";
import * as wishlistService from "../services/wishlist.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; params into res.locals.
type Body<T> = Request<Record<string, string>, unknown, T>;
type ListRes = Response<unknown, { params: { wishlistId: string } }>;
type ItemRes = Response<unknown, { params: WishlistItemParams }>;

export async function list(req: Request, res: Response) {
  ok(res, await wishlistService.listWishlists(currentUser(req).id));
}

export async function getOne(req: Request, res: ListRes) {
  ok(res, await wishlistService.getWishlist(currentUser(req).id, res.locals.params.wishlistId));
}

export async function create(req: Body<WishlistInput>, res: Response) {
  ok(res, await wishlistService.createWishlist(currentUser(req).id, req.body.name), 201);
}

export async function rename(req: Body<WishlistInput>, res: ListRes) {
  ok(res, await wishlistService.renameWishlist(currentUser(req).id, res.locals.params.wishlistId, req.body.name));
}

export async function remove(req: Request, res: ListRes) {
  await wishlistService.deleteWishlist(currentUser(req).id, res.locals.params.wishlistId);
  noContent(res);
}

export async function addHotel(req: Request, res: ItemRes) {
  const { wishlistId, hotelId } = res.locals.params;
  await wishlistService.addHotel(currentUser(req).id, wishlistId, hotelId);
  noContent(res);
}

export async function removeHotel(req: Request, res: ItemRes) {
  const { wishlistId, hotelId } = res.locals.params;
  await wishlistService.removeHotel(currentUser(req).id, wishlistId, hotelId);
  noContent(res);
}
