import { Prisma } from "../generated/prisma/client";

/** Minor units per major unit for the 2-decimal currencies we charge in (THB: 1 baht = 100 satang). */
const MINOR_PER_MAJOR = 100;

/** `Decimal` amount → integer minor units for the payment provider. Decimal math only — no floats. */
export function toMinorUnits(amount: Prisma.Decimal): number {
  const minor = amount.times(MINOR_PER_MAJOR);
  if (!minor.isInteger()) throw new Error(`Amount ${amount.toString()} has more than 2 decimals`);
  return minor.toNumber();
}

/** `Decimal(10,2)` from a validated number (≤ 2 decimals) without float noise. */
export const toPrice = (value: number) => new Prisma.Decimal(value.toFixed(2));
