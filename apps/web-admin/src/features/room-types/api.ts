import {
  adminRoomTypeListSchema,
  adminRoomTypeSchema,
  type RoomTypeInput,
  type UpdateRoomInput,
} from "@booking/shared";
import { request, requestNoContent } from "@/lib/api";

const base = (hotelId: string) => `/api/admin/hotels/${encodeURIComponent(hotelId)}/room-types`;
const one = (hotelId: string, roomTypeId: string) => `${base(hotelId)}/${encodeURIComponent(roomTypeId)}`;

export function fetchRoomTypes(hotelId: string) {
  return request(adminRoomTypeListSchema, { method: "GET", url: base(hotelId) });
}

export function fetchRoomType(hotelId: string, roomTypeId: string) {
  return request(adminRoomTypeSchema, { method: "GET", url: one(hotelId, roomTypeId) });
}

export function createRoomType(hotelId: string, input: RoomTypeInput) {
  return request(adminRoomTypeSchema, { method: "POST", url: base(hotelId), data: input });
}

/** Saves details, images and amenities together (all or nothing). */
export function saveRoomType(hotelId: string, roomTypeId: string, input: RoomTypeInput) {
  return request(adminRoomTypeSchema, { method: "PUT", url: one(hotelId, roomTypeId), data: input });
}

export function setRoomTypeStatus(hotelId: string, roomTypeId: string, isActive: boolean) {
  return request(adminRoomTypeSchema, {
    method: "PATCH",
    url: `${one(hotelId, roomTypeId)}/status`,
    data: { isActive },
  });
}

export function deleteRoomType(hotelId: string, roomTypeId: string) {
  return requestNoContent({ method: "DELETE", url: one(hotelId, roomTypeId) });
}

export function addRoom(hotelId: string, roomTypeId: string, number: string) {
  return request(adminRoomTypeSchema, {
    method: "POST",
    url: `${one(hotelId, roomTypeId)}/rooms`,
    data: { number },
  });
}

export function updateRoom(hotelId: string, roomTypeId: string, roomId: string, input: UpdateRoomInput) {
  return request(adminRoomTypeSchema, {
    method: "PATCH",
    url: `${one(hotelId, roomTypeId)}/rooms/${encodeURIComponent(roomId)}`,
    data: input,
  });
}
