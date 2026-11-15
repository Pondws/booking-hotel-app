import assert from "node:assert/strict";
import { test } from "node:test";
import { splitAcrossNights } from "./night-split";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("splitAcrossNights puts the remainder on the first night", () => {
  assert.deepEqual(splitAcrossNights(100000, 3), [33334, 33333, 33333]);
  assert.deepEqual(splitAcrossNights(100002, 3), [33334, 33334, 33334]);
  assert.deepEqual(splitAcrossNights(1, 2), [1, 0]);
});

test("splitAcrossNights splits evenly and always sums to the total", () => {
  assert.deepEqual(splitAcrossNights(300000, 3), [100000, 100000, 100000]);
  for (const [total, nights] of [[999, 7], [12345, 30], [5, 1]] as const) {
    const parts = splitAcrossNights(total, nights);
    assert.equal(parts.length, nights);
    assert.equal(sum(parts), total);
  }
});

test("splitAcrossNights rejects zero nights", () => {
  assert.throws(() => splitAcrossNights(100, 0));
});
