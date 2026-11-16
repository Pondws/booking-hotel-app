import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Prisma } from "../generated/prisma/client";
import { toDbDate } from "./dates";
import { bestPromotion, isEligible, percentOf, type PromotionRule } from "./promotions";

const rule = (over: Partial<PromotionRule> = {}): PromotionRule => ({
  id: "p1",
  name: "Deal",
  type: "LONG_STAY",
  percentOff: 10,
  minNights: 1,
  minDaysAhead: null,
  maxDaysAhead: null,
  code: null,
  validFrom: null,
  validUntil: null,
  ...over,
});

// Booked on 2030-01-01 for a 3-night stay starting 2030-01-11 (10 days ahead).
const stay = { today: "2030-01-01", checkIn: "2030-01-11", nights: 3 };

describe("isEligible", () => {
  test("min nights", () => {
    assert.equal(isEligible(rule({ minNights: 3 }), stay), true);
    assert.equal(isEligible(rule({ minNights: 4 }), stay), false);
  });

  test("early bird: check-in at least N days ahead", () => {
    assert.equal(isEligible(rule({ type: "EARLY_BIRD", minDaysAhead: 10 }), stay), true);
    assert.equal(isEligible(rule({ type: "EARLY_BIRD", minDaysAhead: 11 }), stay), false);
  });

  test("last minute: check-in at most N days ahead", () => {
    assert.equal(isEligible(rule({ type: "LAST_MINUTE", maxDaysAhead: 10 }), stay), true);
    assert.equal(isEligible(rule({ type: "LAST_MINUTE", maxDaysAhead: 9 }), stay), false);
  });

  test("booking window is inclusive on both ends", () => {
    assert.equal(isEligible(rule({ validFrom: toDbDate("2030-01-01"), validUntil: toDbDate("2030-01-01") }), stay), true);
    assert.equal(isEligible(rule({ validFrom: toDbDate("2030-01-02") }), stay), false);
    assert.equal(isEligible(rule({ validUntil: toDbDate("2029-12-31") }), stay), false);
  });
});

describe("percentOf", () => {
  test("rounds half-up to 2 decimals", () => {
    assert.equal(percentOf(new Prisma.Decimal("1999.50"), 15).toString(), "299.93");
    assert.equal(percentOf(new Prisma.Decimal("0.10"), 5).toString(), "0.01");
    assert.equal(percentOf(new Prisma.Decimal(3000), 10).toString(), "300");
  });
});

describe("bestPromotion", () => {
  test("picks the biggest eligible discount and skips ineligible ones", () => {
    const rules = [
      rule({ id: "a", percentOff: 10 }),
      rule({ id: "b", percentOff: 30, minNights: 5 }),
      rule({ id: "c", percentOff: 20 }),
    ];
    assert.equal(bestPromotion(rules, stay)?.id, "c");
  });

  test("a tie goes to the automatic deal over a code", () => {
    const rules = [rule({ id: "a", percentOff: 15, code: "SAVE15", type: "CODE" }), rule({ id: "b", percentOff: 15 })];
    assert.equal(bestPromotion(rules, stay)?.id, "b");
  });

  test("null when nothing applies", () => {
    assert.equal(bestPromotion([rule({ minNights: 9 })], stay), null);
    assert.equal(bestPromotion([], stay), null);
  });
});
