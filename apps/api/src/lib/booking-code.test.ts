import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingCodeParamsSchema } from "@booking/shared";
import { BOOKING_CODE_ALPHABET, generateBookingCode } from "./booking-code";

test("booking code alphabet has no 0/O/1/I", () => {
  assert.equal(BOOKING_CODE_ALPHABET, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
});
test("booking code: 1,000 generated codes all pass bookingCodeParamsSchema", () => {
  for (let i = 0; i < 1000; i++) {
    const code = generateBookingCode();
    assert.equal(bookingCodeParamsSchema.safeParse({ code }).success, true, code);
  }
});
test("booking code: an injected random gives a fixed code", () => {
  assert.equal(generateBookingCode(() => 0), "BKAAAAAA");
  assert.equal(generateBookingCode((max) => max - 1), "BK999999");
});
