import { test } from "node:test";
import assert from "node:assert/strict";
import { toSlug, withSuffix } from "./slug";

test("toSlug lowercases, strips accents and joins with dashes", () => {
  assert.equal(toSlug("  Riverside Bangkok "), "riverside-bangkok");
  assert.equal(toSlug("Café  & Spa!!"), "cafe-spa");
});
test("toSlug falls back to 'hotel' when nothing Latin remains", () => {
  assert.equal(toSlug("โรงแรมริมน้ำ"), "hotel");
  assert.equal(toSlug("---"), "hotel");
});
test("withSuffix returns base when free, else the next free -n", () => {
  assert.equal(withSuffix("riverside", []), "riverside");
  assert.equal(withSuffix("riverside", ["riverside"]), "riverside-2");
  assert.equal(withSuffix("riverside", ["riverside", "riverside-2", "riverside-4"]), "riverside-3");
});
