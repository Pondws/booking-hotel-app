import { Prisma } from "../generated/prisma/client";
import { eachNight, fromDbDate } from "./dates";

/** A rate period covering nights `[startDate, endDate)`. */
export type PricePeriod = { startDate: Date; endDate: Date; price: Prisma.Decimal };

export type NightlyPrices = {
  nights: number;
  nightly: { date: string; price: Prisma.Decimal }[];
  total: Prisma.Decimal;
};

/**
 * Prices each night in `[checkIn, checkOut)`: the matching rate period's price, else `basePrice`.
 * Periods never overlap (DB constraint), so at most one matches a night.
 */
export function priceNights(
  basePrice: Prisma.Decimal,
  periods: PricePeriod[],
  checkIn: string,
  checkOut: string,
): NightlyPrices {
  const ranges = periods.map((p) => ({
    start: fromDbDate(p.startDate),
    end: fromDbDate(p.endDate),
    price: p.price,
  }));
  const nightly = eachNight(checkIn, checkOut).map((date) => {
    const period = ranges.find((r) => r.start <= date && date < r.end);
    return { date, price: period ? period.price : basePrice };
  });
  const total = nightly.reduce((sum, n) => sum.plus(n.price), new Prisma.Decimal(0));
  return { nights: nightly.length, nightly, total };
}
