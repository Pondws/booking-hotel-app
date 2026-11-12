import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../generated/prisma/client";
import { priceNights, type PricePeriod } from "./stay-pricing";
import { eachNight, fromDbDate, toDbDate } from "./dates";

const base = new Prisma.Decimal(3200);
const april: PricePeriod = {
  startDate: toDbDate("2027-04-10"),
  endDate: toDbDate("2027-04-17"),
  price: new Prisma.Decimal(4500),
};
const prices = (r: ReturnType<typeof priceNights>) => r.nightly.map((n) => n.price.toNumber());

test("dates helpers round-trip YYYY-MM-DD and list nights [checkIn, checkOut)", () => {
  assert.equal(toDbDate("2027-01-10").toISOString(), "2027-01-10T00:00:00.000Z");
  assert.equal(fromDbDate(toDbDate("2027-01-10")), "2027-01-10");
  assert.deepEqual(eachNight("2027-02-27", "2027-03-02"), ["2027-02-27", "2027-02-28", "2027-03-01"]);
  assert.deepEqual(eachNight("2027-01-10", "2027-01-10"), []);
});

test("priceNights with no periods uses base price for every night", () => {
  const r = priceNights(base, [], "2027-01-10", "2027-01-13");
  assert.equal(r.nights, 3);
  assert.equal(r.total.toNumber(), 9600);
  assert.deepEqual(
    r.nightly.map((n) => n.date),
    ["2027-01-10", "2027-01-11", "2027-01-12"],
  );
});

test("priceNights fully inside a period", () => {
  assert.equal(priceNights(base, [april], "2027-04-11", "2027-04-13").total.toNumber(), 9000);
});

test("priceNights crossing a period start", () => {
  const r = priceNights(base, [april], "2027-04-08", "2027-04-12");
  assert.deepEqual(prices(r), [3200, 3200, 4500, 4500]);
  assert.equal(r.total.toNumber(), 15400);
});

test("priceNights treats period endDate as exclusive", () => {
  const r = priceNights(base, [april], "2027-04-15", "2027-04-18");
  assert.deepEqual(prices(r), [4500, 4500, 3200]);
});

test("priceNights with two periods in one stay", () => {
  const may: PricePeriod = {
    startDate: toDbDate("2027-04-17"),
    endDate: toDbDate("2027-04-20"),
    price: new Prisma.Decimal(5000),
  };
  assert.deepEqual(prices(priceNights(base, [april, may], "2027-04-16", "2027-04-18")), [4500, 5000]);
});

test("priceNights keeps decimal precision", () => {
  const r = priceNights(new Prisma.Decimal("1999.50"), [], "2027-01-10", "2027-01-11");
  assert.equal(r.total.toNumber(), 1999.5);
});
