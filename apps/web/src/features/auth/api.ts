import {
  publicUserSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  type ResetPasswordInput,
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

/** Always resolves (204) whether or not the email has an account. */
export function forgotPassword(input: ForgotPasswordInput) {
  return requestNoContent({ method: "POST", url: "/api/auth/forgot-password", data: input });
}

/** One-time token from the emailed link; signs out every device. */
export function resetPassword(input: ResetPasswordInput) {
  return requestNoContent({ method: "POST", url: "/api/auth/reset-password", data: input });
}

/** Signs out every other device; this one stays signed in. */
export function changePassword(input: ChangePasswordInput) {
  return requestNoContent({ method: "POST", url: "/api/auth/me/password", data: input });
}
