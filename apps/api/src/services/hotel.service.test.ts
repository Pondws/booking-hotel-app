import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { toSlug } from "../lib/slug";
import { createHotel, searchHotels } from "./hotel.service";

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

test("searchHotels omits inactive hotels", async () => {
  const city = `${PREFIX}${Date.now()} city`;
  const active = await createHotel({ ...input(`${PREFIX}${Date.now()} active`), city });
  const inactive = await createHotel({ ...input(`${PREFIX}${Date.now()} inactive`), city });
  await prisma.hotel.update({ where: { id: inactive.id }, data: { isActive: false } });
  const result = await searchHotels({ city, page: 1, pageSize: 50 });
  assert.deepEqual(
    result.items.map((x) => x.id),
    [active.id],
  );
});

test("a non-slug P2002 is not retried and propagates", async (t) => {
  const err = new Prisma.PrismaClientKnownRequestError("dup", {
    code: "P2002",
    clientVersion: "test",
    meta: {
      modelName: "Hotel",
      driverAdapterError: {
        cause: { kind: "UniqueConstraintViolation", constraint: { index: "hotels_other_key" } },
      },
    },
  });
  // The delegate exposes methods lazily, so mock.method cannot wrap it; swap the whole delegate.
  const create = t.mock.fn(() => Promise.reject(err));
  const real = prisma.hotel;
  t.mock.property(prisma, "hotel", { ...real, create } as unknown as typeof real);
  await assert.rejects(createHotel(input(`${PREFIX}${Date.now()} other`)), (e) => e === err);
  assert.equal(create.mock.callCount(), 1);
});
