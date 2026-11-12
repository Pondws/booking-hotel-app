import assert from "node:assert/strict";
import { after, test } from "node:test";
import { prisma } from "../lib/prisma";
import { toSlug } from "../lib/slug";
import { createHotel, listActiveHotels } from "./hotel.service";

const PREFIX = "Svc Test ";
const input = (name: string) => ({
  name,
  city: "Testville",
  address: "1 Test Street",
  description: "Created by a test",
});

after(async () => {
  await prisma.hotel.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

test("same name twice → slugs base and base-2", async () => {
  const name = `${PREFIX}${Date.now()} twice`;
  const a = await createHotel(input(name));
  const b = await createHotel(input(name));
  assert.equal(a.slug, toSlug(name));
  assert.equal(b.slug, `${toSlug(name)}-2`);
});

test("concurrent creates with the same new name both succeed with distinct slugs", async () => {
  const name = `${PREFIX}${Date.now()} race`;
  const [a, b] = await Promise.all([createHotel(input(name)), createHotel(input(name))]);
  assert.notEqual(a.slug, b.slug);
  assert.equal(await prisma.hotel.count({ where: { name } }), 2);
});

test("listActiveHotels omits inactive hotels", async () => {
  const name = `${PREFIX}${Date.now()} inactive`;
  const h = await createHotel(input(name));
  await prisma.hotel.update({ where: { id: h.id }, data: { isActive: false } });
  const list = await listActiveHotels();
  assert.ok(!list.some((x) => x.id === h.id));
});
