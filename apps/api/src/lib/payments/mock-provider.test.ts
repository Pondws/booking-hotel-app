import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../app-error";
import { MOCK_WEBHOOK_SIGNATURE, MockProvider } from "./mock-provider";

const input = (key: string) => ({ amountMinor: 300000, currency: "THB", idempotencyKey: key, metadata: {} });
const body = (o: unknown) => Buffer.from(JSON.stringify(o));

test("mock createIntent starts pending and succeed flips it", async () => {
  const mock = new MockProvider();
  const { providerRef, clientSecret } = await mock.createIntent(input("k1"));
  assert.match(providerRef, /^mock_pi_\d+$/);
  assert.equal(clientSecret, `${providerRef}_secret`);
  assert.deepEqual(await mock.getIntent(providerRef), {
    status: "pending",
    amountMinor: 300000,
    currency: "THB",
    clientSecret,
  });
  mock.succeed(providerRef);
  assert.equal((await mock.getIntent(providerRef)).status, "succeeded");
  mock.cancel(providerRef);
  assert.equal((await mock.getIntent(providerRef)).status, "canceled");
});

test("mock createIntent with the same idempotency key returns the same intent", async () => {
  const mock = new MockProvider();
  const a = await mock.createIntent(input("same"));
  const b = await mock.createIntent(input("same"));
  assert.equal(a.providerRef, b.providerRef);
  assert.notEqual((await mock.createIntent(input("other"))).providerRef, a.providerRef);
});

test("mock setAmount changes the intent amount", async () => {
  const mock = new MockProvider();
  const { providerRef } = await mock.createIntent(input("amt"));
  mock.setAmount(providerRef, 1);
  assert.equal((await mock.getIntent(providerRef)).amountMinor, 1);
});

test("mock parseWebhook rejects a bad signature with AppError 400", () => {
  const mock = new MockProvider();
  for (const sig of ["nope", undefined]) {
    assert.throws(
      () => mock.parseWebhook(body({ type: "payment_intent.succeeded", providerRef: "x" }), sig),
      (err: unknown) => err instanceof AppError && err.status === 400,
    );
  }
});

test("mock parseWebhook maps event types", () => {
  const mock = new MockProvider();
  const parse = (type: string) => mock.parseWebhook(body({ type, providerRef: "mock_pi_9" }), MOCK_WEBHOOK_SIGNATURE);
  assert.deepEqual(parse("payment_intent.succeeded"), { type: "succeeded", providerRef: "mock_pi_9" });
  assert.deepEqual(parse("payment_intent.canceled"), { type: "canceled", providerRef: "mock_pi_9" });
  assert.deepEqual(parse("charge.updated"), { type: "ignored" });
});

test("mock refund is idempotent per ref", async () => {
  const mock = new MockProvider();
  await mock.refund("mock_pi_1", { idempotencyKey: "refund-a" });
  await mock.refund("mock_pi_1", { idempotencyKey: "refund-a" });
  assert.deepEqual(mock.refunds, ["mock_pi_1"]);
});

test("mock failNextRefund fails exactly once", async () => {
  const mock = new MockProvider();
  mock.failNextRefund = true;
  await assert.rejects(mock.refund("mock_pi_2", { idempotencyKey: "refund-b" }));
  await mock.refund("mock_pi_2", { idempotencyKey: "refund-b" });
  assert.deepEqual(mock.refunds, ["mock_pi_2"]);
});

test("mock cancelIntent records the ref and cancels the intent", async () => {
  const mock = new MockProvider();
  const { providerRef } = await mock.createIntent(input("c"));
  await mock.cancelIntent(providerRef);
  assert.deepEqual(mock.cancelled, [providerRef]);
  assert.equal((await mock.getIntent(providerRef)).status, "canceled");
});
