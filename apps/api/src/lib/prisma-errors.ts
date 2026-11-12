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
