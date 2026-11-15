import assert from "node:assert/strict";
import { test } from "node:test";
import { diffSnapshots } from "./audit.service";

test("diffSnapshots on update keeps only changed fields, in snapshot order", () => {
  const changes = diffSnapshots(
    { name: "A", city: "Bangkok", images: ["x", "y"], isActive: true },
    { name: "B", city: "Bangkok", images: ["y", "x"], isActive: true },
  );
  assert.deepEqual(changes, [
    { field: "name", before: "A", after: "B" },
    { field: "images", before: ["x", "y"], after: ["y", "x"] },
  ]);
});

test("diffSnapshots treats null, empty string and empty list as the same empty value", () => {
  assert.deepEqual(diffSnapshots({ description: null, images: [] }, { description: "", images: [] }), []);
});

test("diffSnapshots on create lists every set field with before null", () => {
  assert.deepEqual(diffSnapshots(null, { name: "A", description: null, capacity: 2, isActive: false }), [
    { field: "name", before: null, after: "A" },
    { field: "capacity", before: null, after: 2 },
    { field: "isActive", before: null, after: false },
  ]);
});

test("diffSnapshots on delete lists every set field with after null", () => {
  assert.deepEqual(diffSnapshots({ number: "101", isActive: true }, null), [
    { field: "number", before: "101", after: null },
    { field: "isActive", before: true, after: null },
  ]);
});
