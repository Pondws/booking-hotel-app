import { z } from "zod";

const originList = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Browser origins per app (comma-separated). Admin routes accept only ADMIN_ORIGINS,
  // customer auth only WEB_ORIGINS, public routes both — see lib/cors-policy.ts.
  WEB_ORIGINS: originList.default(["http://localhost:3000"]),
  ADMIN_ORIGINS: originList.default(["http://localhost:3001"]),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  // Number of reverse-proxy hops in front of the API (Express "trust proxy"). Never `true`.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // `mock` keeps intents in memory (tests / local dev without Stripe keys); never in production.
  PAYMENT_PROVIDER: z.enum(["stripe", "mock"]).default("stripe"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.PAYMENT_PROVIDER === "mock" && v.NODE_ENV === "production") {
    ctx.addIssue({
      code: "custom",
      path: ["PAYMENT_PROVIDER"],
      message: "PAYMENT_PROVIDER=mock is not allowed in production",
    });
  }
  if (v.PAYMENT_PROVIDER === "stripe") {
    if (!v.STRIPE_SECRET_KEY?.startsWith("sk_")) {
      ctx.addIssue({ code: "custom", path: ["STRIPE_SECRET_KEY"], message: "STRIPE_SECRET_KEY (sk_…) is required" });
    }
    if (!v.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_WEBHOOK_SECRET"],
        message: "STRIPE_WEBHOOK_SECRET (whsec_…) is required",
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
