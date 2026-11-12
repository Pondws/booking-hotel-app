"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchMe, login, logout, register } from "./api";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

/** Drops every cached query outside the auth key family (previous user's data). */
function removeNonAuthQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
}

export function useMe() {
  return useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, staleTime: 5 * 60_000 });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...authKeys.all, "login"],
    mutationFn: login,
    onSuccess: (user) => {
      removeNonAuthQueries(queryClient);
      queryClient.setQueryData(authKeys.me(), user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...authKeys.all, "register"],
    mutationFn: register,
    onSuccess: (user) => {
      removeNonAuthQueries(queryClient);
      queryClient.setQueryData(authKeys.me(), user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...authKeys.all, "logout"],
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me(), null);
      removeNonAuthQueries(queryClient);
    },
  });
}
