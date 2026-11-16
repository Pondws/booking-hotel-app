import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as rewardsService from "../services/rewards.service";
import { currentUser } from "./booking.controller";

export async function getMine(req: Request, res: Response) {
  ok(res, await rewardsService.getMyRewards(currentUser(req)));
}
