import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/lib/api";

const detailsSchema = z.object({ fieldErrors: z.record(z.string(), z.array(z.string())) });

/** Maps a server VALIDATION_FAILED `details.fieldErrors` onto form fields. Returns true if any were mapped. */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly FieldPath<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.code !== "VALIDATION_FAILED") return false;
  const parsed = detailsSchema.safeParse(error.details);
  if (!parsed.success) return false;
  let mapped = false;
  for (const field of fields) {
    const message = parsed.data.fieldErrors[field]?.[0];
    if (message !== undefined) {
      setError(field, { type: "server", message });
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
