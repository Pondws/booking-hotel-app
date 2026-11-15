import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as paymentService from "../services/payment.service";
import { currentUser } from "./booking.controller";

type CodeParams = { code: string };

// Params are already parsed by validate().
export async function start(req: Request, res: Response<unknown, { params: CodeParams }>) {
  ok(res, await paymentService.startPayment(currentUser(req), res.locals.params.code), 201);
}
