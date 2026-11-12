"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createHotel, fetchHotels } from "./api";

export const hotelKeys = {
  all: ["hotels"] as const,
  list: () => [...hotelKeys.all, "list"] as const,
};

export function useHotels() {
  return useQuery({ queryKey: hotelKeys.list(), queryFn: fetchHotels });
}

export function useCreateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHotel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelKeys.all }),
  });
}
