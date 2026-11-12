import { z } from "zod";

// ---------- API envelope ----------
export const errorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// `code` is a plain string so older clients survive new server codes.
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const dataEnvelope = <S extends z.ZodType>(schema: S) => z.object({ data: schema });

// ---------- Auth ----------
export const roleSchema = z.enum(["CUSTOMER", "STAFF", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  role: roleSchema,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

const emailField = z.string().trim().toLowerCase().pipe(z.email());

export const registerSchema = z.object({
  email: emailField,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

const UNSAFE_NEXT_CHARS = /[\u0000-\u001F\u007F\\\s]/;
const NEXT_BASE_ORIGIN = "http://x";

/**
 * Returns `next` as a same-origin path (pathname + search + hash) only when it is a plain
 * absolute path; otherwise "/". Rejects control chars, whitespace and backslashes, which
 * URL parsing strips or rewrites (e.g. "/\t/evil.com" would become "//evil.com").
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || UNSAFE_NEXT_CHARS.test(next)) {
    return "/";
  }
  let url: URL;
  try {
    url = new URL(next, NEXT_BASE_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== NEXT_BASE_ORIGIN) return "/";
  const path = url.pathname + url.search + url.hash;
  // Dot segments can normalize into a protocol-relative path ("/.//evil.com" → "//evil.com")
  return path.startsWith("//") ? "/" : path;
}

// ---------- Hotel ----------
export const hotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  currency: z.string(),
  ratingAvg: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  createdAt: z.coerce.date(),
});
export type Hotel = z.infer<typeof hotelSchema>;

export const hotelListSchema = z.array(hotelSchema);

export const createHotelSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  city: z.string().trim().min(1, "City is required").max(80),
  address: z.string().trim().min(1, "Address is required").max(255),
  description: z.string().trim().max(2000).optional(),
});
export type CreateHotelInput = z.input<typeof createHotelSchema>;
export type CreateHotelData = z.output<typeof createHotelSchema>;

// ---------- Booking ----------
export const createBookingSchema = z
  .object({
    roomTypeId: z.string().min(1),
    checkIn: z.iso.date(),
    checkOut: z.iso.date(),
    guests: z.coerce.number().int().min(1).max(20),
    guestName: z.string().trim().min(1).max(120).optional(),
    guestEmail: z.email().optional(),
    guestPhone: z.string().trim().min(1).max(30).optional(),
  })
  .refine((b) => b.checkOut > b.checkIn, {
    message: "checkOut must be after checkIn",
    path: ["checkOut"],
  });
export type CreateBookingInput = z.input<typeof createBookingSchema>;

// ---------- Health ----------
export const healthSchema = z.object({
  ok: z.boolean(),
  db: z.boolean(),
  timestamp: z.string(),
});
export type Health = z.infer<typeof healthSchema>;
