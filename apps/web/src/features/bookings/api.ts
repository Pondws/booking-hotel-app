import {
  bookingListSchema,
  bookingSchema,
  type Booking,
  type CreateBookingInput,
  type CreateReviewData,
  type Paginated,
} from "@booking/shared";
import { request } from "@/lib/api";

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return request(bookingSchema, { method: "POST", url: "/api/bookings", data: input });
}

export function fetchMyBookings(page: number): Promise<Paginated<Booking>> {
  return request(bookingListSchema, { method: "GET", url: "/api/bookings/me", params: { page } });
}

export function fetchBooking(code: string): Promise<Booking> {
  return request(bookingSchema, {
    method: "GET",
    url: `/api/bookings/${encodeURIComponent(code)}`,
  });
}

export function cancelBooking(code: string): Promise<Booking> {
  return request(bookingSchema, {
    method: "POST",
    url: `/api/bookings/${encodeURIComponent(code)}/cancel`,
  });
}

export function createReview(code: string, input: CreateReviewData): Promise<Booking> {
  return request(bookingSchema, {
    method: "POST",
    url: `/api/bookings/${encodeURIComponent(code)}/review`,
    data: input,
  });
}
