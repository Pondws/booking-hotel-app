import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as dealService from "../services/deal.service";

export async function listDeals(_req: Request, res: Response) {
  ok(res, await dealService.listDeals());
}
