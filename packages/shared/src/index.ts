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

/** `GET /api/admin/amenities` item: an option plus how many hotels / room types use it. */
export const adminAmenitySchema = amenityOptionSchema.extend({
  hotelCount: z.number().int().min(0),
  roomTypeCount: z.number().int().min(0),
});
export type AdminAmenity = z.infer<typeof adminAmenitySchema>;

export const adminAmenityListSchema = z.array(adminAmenitySchema);

export const AMENITY_CODE_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

const amenityCodeField = z
  .string()
  .trim()
  .min(1, "Code is required")
  .max(40, "At most 40 characters")
  .regex(AMENITY_CODE_PATTERN, "Use lowercase letters, digits, - and _ only");
const amenityNameField = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(80, "At most 80 characters");

/** `POST /api/admin/amenities` (ADMIN). Scope is fixed once created. */
export const createAmenitySchema = z.object({
  code: amenityCodeField,
  name: amenityNameField,
  scope: amenityScopeSchema,
});
export type CreateAmenityInput = z.input<typeof createAmenitySchema>;
export type CreateAmenityData = z.output<typeof createAmenitySchema>;

/** `PATCH /api/admin/amenities/:amenityId` (ADMIN). */
export const updateAmenitySchema = z.object({ code: amenityCodeField, name: amenityNameField });
export type UpdateAmenityInput = z.input<typeof updateAmenitySchema>;
export type UpdateAmenityData = z.output<typeof updateAmenitySchema>;

export const amenityIdParamsSchema = z.object({ amenityId: z.string().min(1) });
export type AmenityIdParams = z.output<typeof amenityIdParamsSchema>;

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

export const REVIEW_COMMENT_MAX = 1000;

/** `POST /api/bookings/:code/review`. A blank comment is dropped (stored as null). */
export const createReviewSchema = z.object({
  rating: z
    .number({ error: "Pick a rating" })
    .int("Pick a rating")
    .min(1, "Pick a rating")
    .max(5, "Pick a rating"),
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX, `Keep it under ${REVIEW_COMMENT_MAX} characters`)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});
export type CreateReviewInput = z.input<typeof createReviewSchema>;
export type CreateReviewData = z.output<typeof createReviewSchema>;

/** The caller's own review, as shown on their booking. */
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Review = z.infer<typeof reviewSchema>;

/** A visible review on the public hotel page. Only the reviewer's first name is exposed. */
export const publicReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  authorName: z.string(),
  /** The booking's check-out date (YYYY-MM-DD); the FE shows month + year. */
  stayedAt: isoDate,
  createdAt: z.iso.datetime(),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

/** `GET /api/hotels/:slug/reviews`. Newest first. */
export const hotelReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type HotelReviewsQuery = z.output<typeof hotelReviewsQuerySchema>;

export const hotelReviewListSchema = paginated(publicReviewSchema);
export type HotelReviewList = z.infer<typeof hotelReviewListSchema>;

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
  /** COMPLETED and not reviewed yet. */
  reviewable: z.boolean(),
  review: reviewSchema.nullable(),
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

// ---------- Admin bookings ----------
/** `CONFIRMED` = awaiting arrival; `CHECKED_IN` = CONFIRMED with `checkedInAt` (not a DB status). */
export const ADMIN_BOOKING_STATUS_FILTERS = [
  "all",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type AdminBookingStatusFilter = (typeof ADMIN_BOOKING_STATUS_FILTERS)[number];

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const adminBookingListQuerySchema = z
  .object({
    hotelId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
    status: z.enum(ADMIN_BOOKING_STATUS_FILTERS).default("all"),
    from: z.preprocess(blankToUndefined, isoDate.optional()),
    to: z.preprocess(blankToUndefined, isoDate.optional()),
    q: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine((v, ctx) => {
    if (v.from !== undefined && v.to !== undefined && v.to < v.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "End date must be on or after the start date" });
    }
  });
export type AdminBookingListQuery = z.output<typeof adminBookingListQuerySchema>;

export const adminBookingSummarySchema = z.object({
  code: z.string(),
  status: bookingStatusSchema,
  /** CONFIRMED and checked in (in house). */
  checkedIn: z.boolean(),
  checkIn: isoDate,
  checkOut: isoDate,
  nights: z.number().int().min(1),
  guests: z.number().int().min(1),
  guestName: z.string(),
  guestEmail: z.string(),
  totalAmount: z.number(),
  currency: z.string(),
  /** Latest payment attempt, or null when none was started. */
  paymentStatus: paymentStatusSchema.nullable(),
  hotel: z.object({ id: z.string(), name: z.string() }),
  roomType: z.object({ id: z.string(), name: z.string() }),
  room: z.object({ id: z.string(), number: z.string() }),
  createdAt: z.iso.datetime(),
});
export type AdminBookingSummary = z.infer<typeof adminBookingSummarySchema>;

export const adminBookingListSchema = paginated(adminBookingSummarySchema);

export const adminBookingSchema = adminBookingSummarySchema.extend({
  guestPhone: z.string().nullable(),
  customer: z.object({ name: z.string(), email: z.string() }),
  expiresAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  checkedInAt: z.iso.datetime().nullable(),
  checkedOutAt: z.iso.datetime().nullable(),
  payment: z
    .object({
      status: paymentStatusSchema,
      amount: z.number(),
      provider: z.string(),
      paidAt: z.iso.datetime().nullable(),
      refundedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  hotel: z.object({ id: z.string(), name: z.string(), checkInTime: z.string(), checkOutTime: z.string() }),
  canCheckIn: z.boolean(),
  canCheckOut: z.boolean(),
  canCancel: z.boolean(),
  canMoveRoom: z.boolean(),
});
export type AdminBooking = z.infer<typeof adminBookingSchema>;

export const adminBookingRoomOptionSchema = z.object({
  id: z.string(),
  number: z.string(),
  isActive: z.boolean(),
  /** The booking's current room. */
  current: z.boolean(),
  /** Active, not current, and free for the whole stay. */
  available: z.boolean(),
});
export type AdminBookingRoomOption = z.infer<typeof adminBookingRoomOptionSchema>;

export const adminBookingRoomOptionListSchema = z.array(adminBookingRoomOptionSchema);

export const CANCEL_REASON_MAX = 500;

export const cancelBookingInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason")
    .max(CANCEL_REASON_MAX, `Use at most ${CANCEL_REASON_MAX} characters`),
});
export type CancelBookingInput = z.input<typeof cancelBookingInputSchema>;
export type CancelBookingData = z.output<typeof cancelBookingInputSchema>;

export const moveBookingRoomInputSchema = z.object({ roomId: z.string().min(1, "Choose a room") });
export type MoveBookingRoomInput = z.output<typeof moveBookingRoomInputSchema>;

// ---------- Admin dashboard ----------
export const DASHBOARD_MAX_NIGHTS = 92;
export const DASHBOARD_DEFAULT_NIGHTS = 30;

/** `from` / `to` are inclusive night dates; the API fills in whichever is missing. */
export const adminDashboardQuerySchema = z
  .object({
    hotelId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
    from: z.preprocess(blankToUndefined, isoDate.optional()),
    to: z.preprocess(blankToUndefined, isoDate.optional()),
  })
  .superRefine((v, ctx) => {
    if (v.from === undefined || v.to === undefined) return;
    if (v.to < v.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "End date must be on or after the start date" });
    } else if (nightsBetween(v.from, v.to) + 1 > DASHBOARD_MAX_NIGHTS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `The range can cover at most ${DASHBOARD_MAX_NIGHTS} nights`,
      });
    }
  });
export type AdminDashboardQuery = z.output<typeof adminDashboardQuerySchema>;

export const adminDashboardStaySchema = z.object({
  code: z.string(),
  guestName: z.string(),
  guests: z.number().int().min(1),
  nights: z.number().int().min(1),
  hotel: z.object({ id: z.string(), name: z.string() }),
  roomType: z.object({ id: z.string(), name: z.string() }),
  room: z.object({ id: z.string(), number: z.string() }),
  /** Arrivals: already checked in. Departures: already checked out. */
  done: z.boolean(),
});
export type AdminDashboardStay = z.infer<typeof adminDashboardStaySchema>;

const dashboardStayListSchema = z.object({
  total: z.number().int().min(0),
  done: z.number().int().min(0),
  /** First 20 by guest name. */
  items: z.array(adminDashboardStaySchema),
});

export const adminDashboardSchema = z.object({
  today: isoDate,
  from: isoDate,
  to: isoDate,
  nights: z.number().int().min(1),
  hotelCount: z.number().int().min(0),
  /** Sellable rooms now (room, room type and hotel all active). */
  roomCount: z.number().int().min(0),
  arrivals: dashboardStayListSchema,
  departures: dashboardStayListSchema,
  inHouse: z.number().int().min(0),
  occupancy: z.object({
    roomNightsSold: z.number().int().min(0),
    roomNightsAvailable: z.number().int().min(0),
    /** 0..1 (can exceed 1 if rooms were deactivated after being sold); null when no room is sellable. */
    rate: z.number().nullable(),
    daily: z.array(z.object({ date: isoDate, sold: z.number().int().min(0), rate: z.number().nullable() })),
  }),
  /** One entry per currency in scope, largest total first (every hotel is THB today). */
  revenue: z.array(
    z.object({
      currency: z.string(),
      total: z.number(),
      daily: z.array(z.object({ date: isoDate, amount: z.number() })),
    }),
  ),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

// ---------- Admin staff (ADMIN only) ----------
export const adminStaffListQuerySchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminStaffListQuery = z.output<typeof adminStaffListQuerySchema>;

export const adminStaffSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  hotels: z.array(z.object({ id: z.string(), name: z.string() })),
  /** false = deactivated: can't sign in, sessions revoked. */
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type AdminStaffSummary = z.infer<typeof adminStaffSummarySchema>;

export const adminStaffListSchema = paginated(adminStaffSummarySchema);

export const adminStaffSchema = adminStaffSummarySchema.extend({
  hotels: z.array(
    z.object({ id: z.string(), name: z.string(), city: z.string(), isActive: z.boolean() }),
  ),
  updatedAt: z.iso.datetime(),
});
export type AdminStaff = z.infer<typeof adminStaffSchema>;

const staffNameField = z.string().trim().min(1, "Name is required").max(120);
/** `""` or null → null. */
const staffPhoneField = z
  .string()
  .trim()
  .max(30, "At most 30 characters")
  .nullable()
  .transform((v) => (v === "" ? null : v));

/** `POST /api/admin/staff` — creates a STAFF user. */
export const createStaffSchema = z.object({
  name: staffNameField,
  email: emailField,
  password: registerSchema.shape.password,
  phone: staffPhoneField.default(null),
});
export type CreateStaffInput = z.input<typeof createStaffSchema>;
export type CreateStaffData = z.output<typeof createStaffSchema>;

/** `PATCH /api/admin/staff/:userId`. Email and password don't change here. */
export const updateStaffSchema = z.object({ name: staffNameField, phone: staffPhoneField });
export type UpdateStaffInput = z.input<typeof updateStaffSchema>;
export type UpdateStaffData = z.output<typeof updateStaffSchema>;

/** `PATCH /api/admin/staff/:userId/status`. Deactivating revokes every session of that staff member. */
export const setStaffActiveSchema = z.object({ isActive: z.boolean() });
export type SetStaffActiveInput = z.output<typeof setStaffActiveSchema>;

/** `POST /api/admin/staff/:userId/password` — ADMIN sets a temporary password; revokes every session. */
export const resetStaffPasswordSchema = z.object({ password: registerSchema.shape.password });
export type ResetStaffPasswordInput = z.output<typeof resetStaffPasswordSchema>;

// ---------- Own account (web `/api/auth/me`, web-admin `/api/auth/admin/me`) ----------

/** `PATCH /api/auth/me` + `/api/auth/admin/me`. Same fields as staff edit; email and role never change here. */
export const updateProfileSchema = z.object({ name: staffNameField, phone: staffPhoneField });
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;

/** `POST /api/auth/me/password` + `/api/auth/admin/me/password`. */
export const changePasswordSchema = z.object({
  currentPassword: loginSchema.shape.password,
  newPassword: registerSchema.shape.password,
});
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

export const staffIdParamsSchema = z.object({ userId: z.string().min(1) });
export type StaffIdParams = z.output<typeof staffIdParamsSchema>;

export const staffHotelParamsSchema = staffIdParamsSchema.extend({ hotelId: z.string().min(1) });
export type StaffHotelParams = z.output<typeof staffHotelParamsSchema>;

export const assignStaffHotelSchema = z.object({ hotelId: z.string().min(1, "Choose a hotel") });
export type AssignStaffHotelInput = z.output<typeof assignStaffHotelSchema>;

// ---------- Admin reviews ----------
export const ADMIN_REVIEW_VISIBILITY_FILTERS = ["all", "visible", "hidden"] as const;
export type AdminReviewVisibilityFilter = (typeof ADMIN_REVIEW_VISIBILITY_FILTERS)[number];

/** Newest first. STAFF only see reviews of their own hotels. */
export const adminReviewListQuerySchema = z.object({
  hotelId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  visibility: z.enum(ADMIN_REVIEW_VISIBILITY_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminReviewListQuery = z.output<typeof adminReviewListQuerySchema>;

/** A review as staff see it: hidden ones too, with the guest's full name and the booking. */
export const adminReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  guestName: z.string(),
  bookingCode: z.string(),
  hotel: z.object({ id: z.string(), name: z.string() }),
  /** The booking's check-out date (YYYY-MM-DD). */
  stayedAt: isoDate,
  isHidden: z.boolean(),
  hiddenAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminReview = z.infer<typeof adminReviewSchema>;

export const adminReviewListSchema = paginated(adminReviewSchema);

export const reviewIdParamsSchema = z.object({ reviewId: z.string().min(1) });
export type ReviewIdParams = z.output<typeof reviewIdParamsSchema>;

/** `PATCH /api/admin/reviews/:reviewId`. Hidden reviews leave the hotel page and its rating. */
export const updateReviewVisibilitySchema = z.object({ isHidden: z.boolean() });
export type UpdateReviewVisibilityInput = z.output<typeof updateReviewVisibilitySchema>;

// ---------- Admin audit log ----------
export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;
export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const AUDIT_ENTITY_TYPES = [
  "HOTEL",
  "ROOM_TYPE",
  "ROOM",
  "RATE_PERIOD",
  "AMENITY",
  "STAFF",
  "BOOKING",
  "REVIEW",
] as const;
export const auditEntityTypeSchema = z.enum(AUDIT_ENTITY_TYPES);
export type AuditEntityType = z.infer<typeof auditEntityTypeSchema>;

/** A snapshot field value: scalars, or a list (image URLs, amenity / hotel names). */
export const auditValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]);
export type AuditValue = z.infer<typeof auditValueSchema>;

/** `before` is null on CREATE, `after` is null on DELETE. */
export const auditChangeSchema = z.object({
  field: z.string(),
  before: auditValueSchema,
  after: auditValueSchema,
});
export type AuditChange = z.infer<typeof auditChangeSchema>;

export const adminAuditLogSchema = z.object({
  id: z.string(),
  action: auditActionSchema,
  entityType: auditEntityTypeSchema,
  entityId: z.string(),
  /** The entity's name when the change was made (it may be renamed or deleted since). */
  entityLabel: z.string(),
  hotel: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** Null when the account was removed. */
  actor: z.object({ id: z.string(), name: z.string(), role: roleSchema }).nullable(),
  changes: z.array(auditChangeSchema),
  createdAt: z.iso.datetime(),
});
export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;

export const adminAuditLogListSchema = paginated(adminAuditLogSchema);

/**
 * Newest first. STAFF only ever see rows of their own hotels (amenity / staff rows are ADMIN only).
 * `entityId` = one entity's history: its own rows plus its children's (a room type's rooms and rate periods).
 */
export const adminAuditLogListQuerySchema = z.object({
  hotelId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  entityType: z.preprocess(blankToUndefined, auditEntityTypeSchema.optional()),
  entityId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  action: z.preprocess(blankToUndefined, auditActionSchema.optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminAuditLogListQuery = z.output<typeof adminAuditLogListQuerySchema>;

// ---------- Health ----------
export const healthSchema = z.object({
  ok: z.boolean(),
  db: z.boolean(),
  timestamp: z.string(),
});
export type Health = z.infer<typeof healthSchema>;
