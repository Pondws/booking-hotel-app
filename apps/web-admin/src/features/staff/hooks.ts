"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { AdminStaff, AdminStaffListQuery, CreateStaffInput, UpdateStaffInput } from "@booking/shared";
import {
  assignStaffHotel,
  createStaff,
  fetchStaff,
  fetchStaffList,
  removeStaffHotel,
  updateStaff,
} from "./api";

export const adminStaffKeys = {
  all: ["admin-staff"] as const,
  lists: () => [...adminStaffKeys.all, "list"] as const,
  list: (query: AdminStaffListQuery) => [...adminStaffKeys.lists(), query] as const,
  detail: (userId: string) => [...adminStaffKeys.all, "detail", userId] as const,
};

export function useStaffList(query: AdminStaffListQuery) {
  return useQuery({
    queryKey: adminStaffKeys.list(query),
    queryFn: () => fetchStaffList(query),
    placeholderData: keepPreviousData,
  });
}

export function useStaff(userId: string) {
  return useQuery({ queryKey: adminStaffKeys.detail(userId), queryFn: () => fetchStaff(userId) });
}

/** Writes return the full staff member: cache it and refresh the lists (they show hotels too). */
function storeStaff(queryClient: QueryClient, staff: AdminStaff) {
  queryClient.setQueryData(adminStaffKeys.detail(staff.id), staff);
  return queryClient.invalidateQueries({ queryKey: adminStaffKeys.lists() });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => createStaff(input),
    onSuccess: (staff) => storeStaff(queryClient, staff),
  });
}

export function useUpdateStaff(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStaffInput) => updateStaff(userId, input),
    onSuccess: (staff) => storeStaff(queryClient, staff),
  });
}

export function useAssignStaffHotel(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hotelId: string) => assignStaffHotel(userId, hotelId),
    onSuccess: (staff) => storeStaff(queryClient, staff),
  });
}

export function useRemoveStaffHotel(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hotelId: string) => removeStaffHotel(userId, hotelId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminStaffKeys.detail(userId) }),
        queryClient.invalidateQueries({ queryKey: adminStaffKeys.lists() }),
      ]),
  });
}
