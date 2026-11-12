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
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
