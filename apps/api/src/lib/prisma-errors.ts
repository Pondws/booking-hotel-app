import { Prisma } from "../generated/prisma/client";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/**
 * True when `err` is a P2002 unique violation on `field`.
 * With the PrismaPg driver adapter the target is not in `meta.target`; it is
 * `meta.driverAdapterError.cause.constraint` ({ index: "hotels_slug_key" } or
 * { fields: [...] }). The classic `meta.target` shape is accepted too.
 */
export function isUniqueViolationOn(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const meta: unknown = err.meta;
  if (!isRecord(meta)) return false;

  const target = meta.target;
  if (typeof target === "string" && target.includes(field)) return true;
  if (Array.isArray(target) && target.includes(field)) return true;

  const adapterError = meta.driverAdapterError;
  const cause = isRecord(adapterError) ? adapterError.cause : undefined;
  const constraint = isRecord(cause) ? cause.constraint : undefined;
  if (!isRecord(constraint)) return false;
  if (Array.isArray(constraint.fields) && constraint.fields.includes(field)) return true;
  return typeof constraint.index === "string" && constraint.index.endsWith(`_${field}_key`);
}

/**
 * True when `err` is a Postgres exclusion violation (23P01) on `constraint`.
 * With PrismaPg it surfaces as a known request error (generic code P2039) whose
 * `meta.driverAdapterError.cause` has `originalCode: "23P01"`. The cause has no
 * structured constraint field, so the name is matched in its quoted message:
 * `… violates exclusion constraint "bookings_no_overlap"`.
 */
export function isExclusionViolation(err: unknown, constraint = "bookings_no_overlap"): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const meta: unknown = err.meta;
  const adapterError = isRecord(meta) ? meta.driverAdapterError : undefined;
  const cause = isRecord(adapterError) ? adapterError.cause : undefined;
  if (!isRecord(cause) || cause.originalCode !== "23P01") return false;
  const message = typeof cause.originalMessage === "string" ? cause.originalMessage : cause.message;
  return typeof message === "string" && message.includes(`"${constraint}"`);
}
