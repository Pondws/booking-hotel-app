import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as destinationService from "../services/destination.service";

export async function listDestinations(_req: Request, res: Response) {
  ok(res, await destinationService.listDestinations());
}
