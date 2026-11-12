import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api";

/** Maps a server VALIDATION_FAILED `details.fieldErrors` onto form fields. Returns true if any were mapped. */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly FieldPath<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.code !== "VALIDATION_FAILED") return false;
  const details = error.details;
  if (typeof details !== "object" || details === null || !("fieldErrors" in details)) return false;
  const fieldErrors = details.fieldErrors;
  if (typeof fieldErrors !== "object" || fieldErrors === null) return false;
  let mapped = false;
  for (const field of fields) {
    if (!(field in fieldErrors)) continue;
    const messages = (fieldErrors as Record<string, unknown>)[field];
    if (Array.isArray(messages) && typeof messages[0] === "string") {
      setError(field, { type: "server", message: messages[0] });
      mapped = true;
    }
  }
  return mapped;
}

/** Human message for an API error that is not tied to a field. */
export function formErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.code === "RATE_LIMITED") return "Too many attempts, try again later";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
