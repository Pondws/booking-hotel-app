import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { z, ZodError } from "zod";
import { env } from "./env";
import { healthRouter } from "./routes/health";
import { hotelsRouter } from "./routes/hotels";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/hotels", hotelsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: z.flattenError(err) });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);
