import express from "express";
import { env } from "./env";
import { corsPolicy } from "./lib/cors-policy";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { hotelsRouter } from "./routes/hotels";

export const app = express();

// Hop count only, so X-Forwarded-For cannot be spoofed past the known proxies (req.ip
// feeds the auth rate limiter and session rows).
app.set("trust proxy", env.TRUST_PROXY);

app.use(corsPolicy({ web: env.WEB_ORIGINS, admin: env.ADMIN_ORIGINS }));
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/hotels", hotelsRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);
