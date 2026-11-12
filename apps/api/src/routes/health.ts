import { Router } from "express";
import type { Health } from "@booking/shared";
import { prisma } from "../lib/prisma";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  const body: Health = { ok: true, db, timestamp: new Date().toISOString() };
  res.status(db ? 200 : 503).json(body);
});
