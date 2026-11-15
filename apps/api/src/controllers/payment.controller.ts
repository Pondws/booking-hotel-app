import type { Request, Response } from "express";
import { AppError } from "../lib/app-error";
import { ok } from "../lib/http";
import * as paymentService from "../services/payment.service";
import { currentUser } from "./booking.controller";

type CodeParams = { code: string };

// Params are already parsed by validate().
export async function start(req: Request, res: Response<unknown, { params: CodeParams }>) {
  ok(res, await paymentService.startPayment(currentUser(req), res.locals.params.code), 201);
}

/** Server-to-server: `express.raw` keeps the body a Buffer so the signature can be verified. */
export async function webhook(req: Request, res: Response) {
  if (!Buffer.isBuffer(req.body)) throw new AppError(400, "VALIDATION_FAILED", "Expected a JSON webhook body");
  await paymentService.handleWebhook(req.body, req.get("stripe-signature"));
  ok(res, { received: true });
}
