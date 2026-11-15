import { z } from "zod";

// ---------- API envelope ----------
export const errorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "ROOM_UNAVAILABLE",
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

/** 24-hour `HH:mm`. */
export const hotelTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour)");

const hotelNameField = z.string().trim().min(1, "Name is required").max(120);
const hotelCityField = z.string().trim().min(1, "City is required").max(80);
const hotelAddressField = z.string().trim().min(1, "Address is required").max(255);

/** Slug and currency never change on edit. `description: ""` or `null` clears it. */
export const updateHotelSchema = z
  .object({
    name: hotelNameField.optional(),
    city: hotelCityField.optional(),
    address: hotelAddressField.optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
    checkInTime: hotelTimeSchema.optional(),
    checkOutTime: hotelTimeSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update" });
export type UpdateHotelInput = z.input<typeof updateHotelSchema>;
export type UpdateHotelData = z.output<typeof updateHotelSchema>;

const hotelImagesField = z
  .array(
    z.object({
      url: z.url({ protocol: /^https?$/ }).max(2048),
      alt: z.string().trim().max(200).optional(),
    }),
  )
  .max(20);
const hotelAmenityIdsField = z.array(z.string().min(1)).max(50);

function refineUniqueImageUrls(v: { images: { url: string }[] }, ctx: z.RefinementCtx): void {
  if (new Set(v.images.map((i) => i.url)).size !== v.images.length) {
    ctx.addIssue({ code: "custom", path: ["images"], message: "Each image URL must be unique" });
  }
}
function refineUniqueAmenityIds(v: { amenityIds: string[] }, ctx: z.RefinementCtx): void {
  if (new Set(v.amenityIds).size !== v.amenityIds.length) {
    ctx.addIssue({ code: "custom", path: ["amenityIds"], message: "Each amenity can only be added once" });
  }
}

export const hotelImagesInputSchema = z
  .object({ images: hotelImagesField })
  .superRefine(refineUniqueImageUrls);
export type HotelImagesInput = z.output<typeof hotelImagesInputSchema>;

export const hotelAmenitiesInputSchema = z
  .object({ amenityIds: hotelAmenityIdsField })
  .superRefine(refineUniqueAmenityIds);
export type HotelAmenitiesInput = z.output<typeof hotelAmenitiesInputSchema>;

/**
 * `PUT /api/admin/hotels/:hotelId` — the whole editable hotel (details, times, ordered images, hotel
 * amenities) saved in one transaction. Slug and currency never change. `description: ""` clears it.
 */
export const hotelContentInputSchema = z
  .object({
    name: hotelNameField,
    city: hotelCityField,
    address: hotelAddressField,
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .transform((v) => (v === "" ? null : v)),
    checkInTime: hotelTimeSchema,
    checkOutTime: hotelTimeSchema,
    images: hotelImagesField,
    amenityIds: hotelAmenityIdsField,
  })
  .superRefine((v, ctx) => {
    refineUniqueImageUrls(v, ctx);
    refineUniqueAmenityIds(v, ctx);
  });
export type HotelContentInput = z.input<typeof hotelContentInputSchema>;
export type HotelContentData = z.output<typeof hotelContentInputSchema>;

/** `POST /api/admin/hotels` — same fields as the edit form; times, images and amenities are optional. */
export const createHotelSchema = z
  .object({
    name: hotelNameField,
    city: hotelCityField,
    address: hotelAddressField,
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
    checkInTime: hotelTimeSchema.optional(),
    checkOutTime: hotelTimeSchema.optional(),
    images: hotelImagesField.default([]),
    amenityIds: hotelAmenityIdsField.default([]),
  })
  .superRefine((v, ctx) => {
    refineUniqueImageUrls(v, ctx);
    refineUniqueAmenityIds(v, ctx);
  });
export type CreateHotelInput = z.input<typeof createHotelSchema>;
export type CreateHotelData = z.output<typeof createHotelSchema>;

// ---------- Uploads ----------
/** `POST /api/admin/uploads/images` takes the raw file as the body with one of these `Content-Type`s. */
export const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageUploadType = (typeof IMAGE_UPLOAD_TYPES)[number];
export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const uploadedImageSchema = z.object({ url: z.string() });
export type UploadedImage = z.infer<typeof uploadedImageSchema>;

export const hotelStatusInputSchema = z.object({ isActive: z.boolean() });
export type HotelStatusInput = z.output<typeof hotelStatusInputSchema>;

export const hotelIdParamsSchema = z.object({ hotelId: z.string().min(1) });
export type HotelIdParams = z.output<typeof hotelIdParamsSchema>;

// ---------- Admin room types + rooms (input) ----------
export const ROOM_TYPE_MAX_CAPACITY = 20;
const MAX_PRICE = 99_999_999.99;

/** Whole cents only (`Decimal(10,2)` in the DB). */
const hasAtMostTwoDecimals = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

/** A nightly price: 0–99,999,999.99 with at most 2 decimals (`Decimal(10,2)`). */
const priceField = z
  .number({ error: "Enter a price" })
  .min(0, "Price can't be negative")
  .max(MAX_PRICE, "Price is too high")
  .refine(hasAtMostTwoDecimals, "Use at most 2 decimal places");

/**
 * `POST /api/admin/hotels/:hotelId/room-types` and `PUT …/room-types/:roomTypeId` — the whole room type
 * (details, ordered images, ROOM amenities) saved in one transaction. `description: ""` clears it.
 */
export const roomTypeInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    capacity: z
      .number({ error: "Enter how many guests" })
      .int("Use a whole number")
      .min(1, "At least 1 guest")
      .max(ROOM_TYPE_MAX_CAPACITY, `At most ${ROOM_TYPE_MAX_CAPACITY} guests`),
    basePrice: priceField,
    images: hotelImagesField,
    amenityIds: hotelAmenityIdsField,
  })
  .superRefine((v, ctx) => {
    refineUniqueImageUrls(v, ctx);
    refineUniqueAmenityIds(v, ctx);
  });
export type RoomTypeInput = z.input<typeof roomTypeInputSchema>;
export type RoomTypeData = z.output<typeof roomTypeInputSchema>;

export const roomNumberSchema = z
  .string()
  .trim()
  .min(1, "Room number is required")
  .max(20, "At most 20 characters")
  .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits and - only");

export const createRoomSchema = z.object({ number: roomNumberSchema });
export type CreateRoomInput = z.input<typeof createRoomSchema>;

export const updateRoomSchema = z
  .object({ number: roomNumberSchema.optional(), isActive: z.boolean().optional() })
  .refine((v) => v.number !== undefined || v.isActive !== undefined, { message: "Nothing to update" });
export type UpdateRoomInput = z.input<typeof updateRoomSchema>;
export type UpdateRoomData = z.output<typeof updateRoomSchema>;

export const roomTypeParamsSchema = z.object({
  hotelId: z.string().min(1),
  roomTypeId: z.string().min(1),
});
export type RoomTypeParams = z.output<typeof roomTypeParamsSchema>;

export const roomParamsSchema = roomTypeParamsSchema.extend({ roomId: z.string().min(1) });
export type RoomParams = z.output<typeof roomParamsSchema>;

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

// ---------- Admin rate periods (input) ----------
export const RATE_PERIOD_MAX_NIGHTS = 366;

/**
 * `POST …/room-types/:roomTypeId/rate-periods` and `PUT …/rate-periods/:ratePeriodId` — `price` replaces the
 * room type's base price for every night in `[startDate, endDate)`. `name: ""` clears it.
 */
export const ratePeriodInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(80, "At most 80 characters")
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    startDate: z.iso.date({ error: "Pick the dates" }),
    endDate: z.iso.date({ error: "Pick the dates" }),
    price: priceField,
  })
  .superRefine((v, ctx) => {
    if (v.endDate <= v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end date must be after the start date" });
    } else if (nightsBetween(v.startDate, v.endDate) > RATE_PERIOD_MAX_NIGHTS) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `A rate period can cover at most ${RATE_PERIOD_MAX_NIGHTS} nights`,
      });
    }
  });
export type RatePeriodInput = z.input<typeof ratePeriodInputSchema>;
export type RatePeriodData = z.output<typeof ratePeriodInputSchema>;

export const ratePeriodParamsSchema = roomTypeParamsSchema.extend({ ratePeriodId: z.string().min(1) });
export type RatePeriodParams = z.output<typeof ratePeriodParamsSchema>;

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

// ---------- Admin hotels ----------
export const adminHotelSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  isActive: z.boolean(),
  coverImage: imageSchema.nullable(),
  updatedAt: z.iso.datetime(),
});
export type AdminHotelSummary = z.infer<typeof adminHotelSummarySchema>;

export const adminHotelListSchema = paginated(adminHotelSummarySchema);

export const adminHotelListQuerySchema = z.object({
  q: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
  status: z.enum(["active", "inactive", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminHotelListQuery = z.output<typeof adminHotelListQuerySchema>;

export const adminHotelImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type AdminHotelImage = z.infer<typeof adminHotelImageSchema>;

export const adminHotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  currency: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  isActive: z.boolean(),
  images: z.array(adminHotelImageSchema),
  amenities: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminHotel = z.infer<typeof adminHotelSchema>;

export const amenityScopeSchema = z.enum(["HOTEL", "ROOM"]);
export type AmenityScope = z.infer<typeof amenityScopeSchema>;

export const amenityOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  scope: amenityScopeSchema,
});
export type AmenityOption = z.infer<typeof amenityOptionSchema>;

export const amenityOptionListSchema = z.array(amenityOptionSchema);

export const amenityListQuerySchema = z.object({ scope: amenityScopeSchema.optional() });
export type AmenityListQuery = z.output<typeof amenityListQuerySchema>;

// ---------- Admin room types + rooms (output) ----------
export const adminRoomTypeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number().int(),
  basePrice: z.number(),
  isActive: z.boolean(),
  roomCount: z.number().int(),
  activeRoomCount: z.number().int(),
  coverImage: imageSchema.nullable(),
  updatedAt: z.iso.datetime(),
});
export type AdminRoomTypeSummary = z.infer<typeof adminRoomTypeSummarySchema>;

export const adminRoomTypeListSchema = z.array(adminRoomTypeSummarySchema);

export const adminRoomSchema = z.object({
  id: z.string(),
  number: z.string(),
  isActive: z.boolean(),
});
export type AdminRoom = z.infer<typeof adminRoomSchema>;

export const adminRoomTypeSchema = z.object({
  id: z.string(),
  hotel: z.object({ id: z.string(), name: z.string(), currency: z.string() }),
  name: z.string(),
  description: z.string().nullable(),
  capacity: z.number().int(),
  basePrice: z.number(),
  isActive: z.boolean(),
  images: z.array(adminHotelImageSchema),
  amenities: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
  rooms: z.array(adminRoomSchema),
  /** True while no rooms or rate periods depend on it. */
  deletable: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminRoomType = z.infer<typeof adminRoomTypeSchema>;

export const adminRatePeriodSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  /** First night priced at `price`. */
  startDate: z.iso.date(),
  /** Exclusive: the night of `endDate` is back to the base price (or the next period). */
  endDate: z.iso.date(),
  nights: z.number().int(),
  price: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminRatePeriod = z.infer<typeof adminRatePeriodSchema>;

export const adminRatePeriodListSchema = z.array(adminRatePeriodSchema);

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
  checkInTime: z.string(),
  checkOutTime: z.string(),
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
export const HOLD_MINUTES = 15;
export const MAX_ACTIVE_HOLDS = 3;
/** `BK` + 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I). */
export const BOOKING_CODE_PATTERN = /^BK[A-HJ-NP-Z2-9]{6}$/;

export const createBookingSchema = z
  .object({
    roomTypeId: z.string().min(1),
    checkIn: isoDate,
    checkOut: isoDate,
    guests: guestsField,
    guestName: z.string().trim().min(1).max(120).optional(),
    guestEmail: emailField.optional(),
    guestPhone: z.string().trim().min(1).max(30).optional(),
  })
  .superRefine((v, ctx) => refineStay(ctx, v.checkIn, v.checkOut));
export type CreateBookingInput = z.input<typeof createBookingSchema>;
export type CreateBookingData = z.output<typeof createBookingSchema>;

export const bookingStatusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED", "COMPLETED"]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const paymentStatusSchema = z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/** The latest payment attempt of a booking. */
export const bookingPaymentSchema = z.object({
  status: paymentStatusSchema,
  paidAt: z.iso.datetime().nullable(),
  refundedAt: z.iso.datetime().nullable(),
});

/** `POST /api/bookings/:code/payments` → the PaymentIntent secret the browser confirms with Stripe. */
export const startPaymentSchema = z.object({ clientSecret: z.string() });
export type StartPayment = z.infer<typeof startPaymentSchema>;

export const bookingSchema = z.object({
  code: z.string(),
  status: bookingStatusSchema,
  checkIn: isoDate,
  checkOut: isoDate,
  nights: z.number().int().min(1),
  guests: z.number().int().min(1),
  guestName: z.string(),
  guestEmail: z.string(),
  guestPhone: z.string().nullable(),
  totalAmount: z.number(),
  currency: z.string(),
  expiresAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  cancellable: z.boolean(),
  /** An unexpired PENDING hold — the only state that can be paid. */
  payable: z.boolean(),
  payment: bookingPaymentSchema.nullable(),
  hotel: z.object({
    name: z.string(),
    slug: z.string(),
    city: z.string(),
    checkInTime: z.string(),
    checkOutTime: z.string(),
    coverImage: imageSchema.nullable(),
  }),
  roomType: z.object({ id: z.string(), name: z.string() }),
});
export type Booking = z.infer<typeof bookingSchema>;

export const bookingListSchema = paginated(bookingSchema);

export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type BookingListQuery = z.output<typeof bookingListQuerySchema>;

export const bookingCodeParamsSchema = z.object({ code: z.string().regex(BOOKING_CODE_PATTERN) });
export type BookingCodeParams = z.output<typeof bookingCodeParamsSchema>;

// ---------- Health ----------
export const healthSchema = z.object({
  ok: z.boolean(),
  db: z.boolean(),
  timestamp: z.string(),
});
export type Health = z.infer<typeof healthSchema>;
