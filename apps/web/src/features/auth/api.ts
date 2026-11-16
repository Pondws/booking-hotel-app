import {
  publicUserSchema,
  type ChangePasswordInput,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  type UpdateProfileInput,
} from "@booking/shared";
import { ApiError, request, requestNoContent } from "@/lib/api";

export async function fetchMe(): Promise<PublicUser | null> {
  try {
    return await request(publicUserSchema, { method: "GET", url: "/api/auth/me" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function login(input: LoginInput) {
  return request(publicUserSchema, { method: "POST", url: "/api/auth/login", data: input });
}

export function register(input: RegisterInput) {
  return request(publicUserSchema, { method: "POST", url: "/api/auth/register", data: input });
}

export function logout() {
  return requestNoContent({ method: "POST", url: "/api/auth/logout" });
}

export function updateProfile(input: UpdateProfileInput) {
  return request(publicUserSchema, { method: "PATCH", url: "/api/auth/me", data: input });
}

/** Signs out every other device; this one stays signed in. */
export function changePassword(input: ChangePasswordInput) {
  return requestNoContent({ method: "POST", url: "/api/auth/me/password", data: input });
}
