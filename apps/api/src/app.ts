import express from "express";
import { env } from "./env";
import { corsPolicy } from "./lib/cors-policy";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { bookingsRouter } from "./routes/bookings";
import { healthRouter } from "./routes/health";
import { amenitiesRouter } from "./routes/amenities";
import { dealsRouter } from "./routes/deals";
import { destinationsRouter } from "./routes/destinations";
import { hotelsRouter } from "./routes/hotels";
import { rewardsRouter } from "./routes/rewards";
import { wishlistsRouter } from "./routes/wishlists";
import { webhooksRouter } from "./routes/webhooks";

export const app = express();

// Hop count only, so X-Forwarded-For cannot be spoofed past the known proxies (req.ip
// feeds the auth rate limiter and session rows).
app.set("trust proxy", env.TRUST_PROXY);

app.use(corsPolicy({ web: env.WEB_ORIGINS, admin: env.ADMIN_ORIGINS }));
// Webhooks need the raw body for signature checks — mount before the JSON parser.
app.use("/api/webhooks", webhooksRouter);
app.use(express.json());

// Uploaded images (see routes/admin/uploads.ts). Never executed or sniffed as anything but the stored type.
app.use(
  "/uploads",
  express.static(env.UPLOAD_DIR, {
    index: false,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/hotels", hotelsRouter);
app.use("/api/amenities", amenitiesRouter);
app.use("/api/deals", dealsRouter);
app.use("/api/destinations", destinationsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/rewards", rewardsRouter);
app.use("/api/wishlists", wishlistsRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);
