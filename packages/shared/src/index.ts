import { z } from "zod";

// ---------- Hotel ----------
export const hotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  description: z.string().nullable(),
  rating: z.number().min(0).max(5),
  createdAt: z.coerce.date(),
});
export type Hotel = z.infer<typeof hotelSchema>;

export const hotelListSchema = z.array(hotelSchema);

export const createHotelSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  city: z.string().trim().min(1, "City is required").max(80),
  description: z.string().trim().max(2000).optional(),
  rating: z.coerce.number().min(0).max(5).default(0),
});
export type CreateHotelInput = z.input<typeof createHotelSchema>;
export type CreateHotelData = z.output<typeof createHotelSchema>;

// ---------- Booking ----------
export const createBookingSchema = z
  .object({
    roomId: z.string().min(1),
    guestName: z.string().trim().min(1).max(120),
    guestEmail: z.email(),
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
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
