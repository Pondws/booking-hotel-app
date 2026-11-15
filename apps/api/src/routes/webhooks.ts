import express, { Router } from "express";
import { webhook } from "../controllers/payment.controller";

/**
 * Provider webhooks. Mounted in app.ts BEFORE `express.json()`: the signature is computed over the
 * exact raw bytes, so the body must stay a Buffer. No session or CORS — the caller is Stripe.
 */
export const webhooksRouter = Router();

webhooksRouter.post("/stripe", express.raw({ type: "application/json", limit: "1mb" }), webhook);
