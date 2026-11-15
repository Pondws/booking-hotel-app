/**
 * Split a stay's total (integer minor units) evenly over its nights. The parts sum to `totalMinor`
 * exactly; the leftover satang go to the earliest nights, one each.
 */
export function splitAcrossNights(totalMinor: number, nights: number): number[] {
  if (!Number.isInteger(nights) || nights < 1) throw new Error(`Cannot split over ${nights} nights`);
  const base = Math.floor(totalMinor / nights);
  const remainder = totalMinor - base * nights;
  return Array.from({ length: nights }, (_, i) => base + (i < remainder ? 1 : 0));
}
