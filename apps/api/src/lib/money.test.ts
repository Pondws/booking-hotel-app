import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../generated/prisma/client";
import { toMinorUnits } from "./money";

test("toMinorUnits converts baht to satang", () => {
  assert.equal(toMinorUnits(new Prisma.Decimal("1234.50")), 123450);
  assert.equal(toMinorUnits(new Prisma.Decimal("0.01")), 1);
});

test("toMinorUnits rejects a fractional minor amount", () => {
  assert.throws(() => toMinorUnits(new Prisma.Decimal("10.005")));
});
