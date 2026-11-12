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

// ---------- Catalog ----------
export const BOOKING_TZ = "Asia/Bangkok";
export const MAX_NIGHTS = 30;

const DAY_MS = 86_400_000;

/** Calendar date (`YYYY-MM-DD`) in `tz` at `now`. */
export function todayIn(tz: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Nights in the half-open range `[checkIn, checkOut)`; both `YYYY-MM-DD`. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${checkOut}T00:00:00.000Z`);
  return Math.round((end - start) / DAY_MS);
}

const isoDate = z.iso.date();
const GUESTS_MESSAGE = "Enter 1 to 20 guests";
const guestsField = z.coerce
  .number({ error: GUESTS_MESSAGE })
  .int({ error: GUESTS_MESSAGE })
  .min(1, { error: GUESTS_MESSAGE })
  .max(20, { error: GUESTS_MESSAGE });

function refineStay(ctx: z.RefinementCtx, checkIn: string, checkOut: string): void {
  if (checkIn < todayIn(BOOKING_TZ)) {
    ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Check-in can't be in the past" });
  }
  if (checkOut <= checkIn) {
    ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
  } else if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) {
    ctx.addIssue({
      code: "custom",
      path: ["checkOut"],
      message: `Stays are limited to ${MAX_NIGHTS} nights`,
    });
  }
}

export const stayRangeSchema = z
  .object({
    checkIn: isoDate,
    checkOut: isoDate,
    guests: guestsField.default(1),
  })
  .superRefine((v, ctx) => refineStay(ctx, v.checkIn, v.checkOut));
export type StayRange = z.output<typeof stayRangeSchema>;
export type StayRangeInput = z.input<typeof stayRangeSchema>;

export const hotelSearchQuerySchema = z
  .object({
    city: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().min(1).max(80).optional(),
    ),
    checkIn: isoDate.optional(),
    checkOut: isoDate.optional(),
    guests: guestsField.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
  })
  .superRefine((v, ctx) => {
    if (v.checkIn === undefined && v.checkOut === undefined) return;
    if (v.checkIn === undefined || v.checkOut === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Choose both check-in and check-out",
      });
      return;
    }
    refineStay(ctx, v.checkIn, v.checkOut);
  });
export type HotelSearchQuery = z.output<typeof hotelSearchQuerySchema>;

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const paginated = <S extends z.ZodType>(item: S) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  });

export const imageSchema = z.object({
  url: z.string(),
  alt: z.string().nullable(),
});

export const amenitySchema = z.object({
  code: z.string(),
  name: z.string(),
});

export const hotelSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  currency: z.string(),
  ratingAvg: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  coverImage: imageSchema.nullable(),
  fromPrice: z.number().nullable(),
});
export type HotelSummary = z.infer<typeof hotelSummarySchema>;

export const hotelSearchResultSchema = paginated(hotelSummarySchema);

export const roomTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  capacity: z.number().int().min(1),
  basePrice: z.number(),
  images: z.array(imageSchema),
  amenities: z.array(amenitySchema),
});
export type RoomType = z.infer<typeof roomTypeSchema>;

export const hotelDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  currency: z.string(),
  ratingAvg: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  images: z.array(imageSchema),
  amenities: z.array(amenitySchema),
  roomTypes: z.array(roomTypeSchema),
});
export type HotelDetail = z.infer<typeof hotelDetailSchema>;

export const stayQuoteSchema = z.object({
  nights: z.number().int().min(1),
  nightly: z.array(z.object({ date: isoDate, price: z.number() })),
  total: z.number(),
  currency: z.string(),
});
export type StayQuote = z.infer<typeof stayQuoteSchema>;

export const availabilitySchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.number().int().min(1),
  nights: z.number().int().min(1),
  roomTypes: z.array(
    z.object({
      roomTypeId: z.string(),
      available: z.boolean(),
      availableRooms: z.number().int().min(0),
      quote: stayQuoteSchema,
    }),
  ),
});
export type Availability = z.infer<typeof availabilitySchema>;

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
