import { nightsBetween, type PromotionType } from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { fromDbDate } from "./dates";

/** The columns that decide whether a deal applies and how much it takes off. */
export type PromotionRule = {
  id: string;
  name: string;
  type: PromotionType;
  percentOff: number;
  minNights: number;
  minDaysAhead: number | null;
  maxDaysAhead: number | null;
  code: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
};

export const promotionRuleSelect = {
  id: true,
  name: true,
  type: true,
  percentOff: true,
  minNights: true,
  minDaysAhead: true,
  maxDaysAhead: true,
  code: true,
  validFrom: true,
  validUntil: true,
} as const;

/** A stay as the rules see it: `today` is the booking day in BOOKING_TZ. */
export type StayContext = { today: string; checkIn: string; nights: number };

/** True when `rule` is in its booking window and the stay meets every condition it sets. */
export function isEligible(rule: PromotionRule, stay: StayContext): boolean {
  if (rule.validFrom && stay.today < fromDbDate(rule.validFrom)) return false;
  if (rule.validUntil && stay.today > fromDbDate(rule.validUntil)) return false;
  if (stay.nights < rule.minNights) return false;
  const daysAhead = nightsBetween(stay.today, stay.checkIn);
  if (rule.minDaysAhead !== null && daysAhead < rule.minDaysAhead) return false;
  if (rule.maxDaysAhead !== null && daysAhead > rule.maxDaysAhead) return false;
  return true;
}

/** `percentOff`% of `amount`, rounded half-up to satang. */
export function percentOf(amount: Prisma.Decimal, percentOff: number): Prisma.Decimal {
  return amount.times(percentOff).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** The eligible rule with the biggest discount (deals never stack); ties go to the automatic one, then id. */
export function bestPromotion<R extends PromotionRule>(rules: R[], stay: StayContext): R | null {
  const rank = (r: R) => [r.percentOff, r.code === null ? 1 : 0] as const;
  let best: R | null = null;
  for (const rule of rules) {
    if (!isEligible(rule, stay)) continue;
    if (best === null) {
      best = rule;
      continue;
    }
    const [p, auto] = rank(rule);
    const [bp, bauto] = rank(best);
    if (p > bp || (p === bp && (auto > bauto || (auto === bauto && rule.id < best.id)))) best = rule;
  }
  return best;
}
