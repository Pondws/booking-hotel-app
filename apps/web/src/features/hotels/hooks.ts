"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHotels } from "./api";

export const hotelKeys = {
  all: ["hotels"] as const,
  list: () => [...hotelKeys.all, "list"] as const,
};

export function useHotels() {
  return useQuery({ queryKey: hotelKeys.list(), queryFn: fetchHotels });
}
