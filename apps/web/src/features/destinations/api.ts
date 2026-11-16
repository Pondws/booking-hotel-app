import { destinationListSchema, type Destination } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchDestinations(): Promise<Destination[]> {
  return request(destinationListSchema, { method: "GET", url: "/api/destinations" });
}
