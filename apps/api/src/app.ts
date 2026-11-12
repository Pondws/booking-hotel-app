import cors from "cors";
import express from "express";
import { env } from "./env";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { healthRouter } from "./routes/health";
import { hotelsRouter } from "./routes/hotels";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/hotels", hotelsRouter);

app.use(notFound);
app.use(errorHandler);
