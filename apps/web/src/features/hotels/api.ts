import {
  availabilitySchema,
  hotelDetailSchema,
  hotelReviewListSchema,
  hotelSearchResultSchema,
  type Availability,
  type HotelDetail,
  type HotelReviewList,
  type HotelReviewsQuery,
  type HotelSearchQuery,
  type HotelSummary,
  type Paginated,
  type StayRange,
} from "@booking/shared";
import { request } from "@/lib/api";

export function searchHotels(q: HotelSearchQuery): Promise<Paginated<HotelSummary>> {
  return request(hotelSearchResultSchema, { method: "GET", url: "/api/hotels", params: q });
}

export function fetchHotel(slug: string): Promise<HotelDetail> {
  return request(hotelDetailSchema, {
    method: "GET",
    url: `/api/hotels/${encodeURIComponent(slug)}`,
  });
}

export function fetchHotelReviews(slug: string, q: HotelReviewsQuery): Promise<HotelReviewList> {
  return request(hotelReviewListSchema, {
    method: "GET",
    url: `/api/hotels/${encodeURIComponent(slug)}/reviews`,
    params: q,
  });
}

export function fetchAvailability(slug: string, range: StayRange): Promise<Availability> {
  return request(availabilitySchema, {
    method: "GET",
    url: `/api/hotels/${encodeURIComponent(slug)}/availability`,
    params: range,
  });
}
