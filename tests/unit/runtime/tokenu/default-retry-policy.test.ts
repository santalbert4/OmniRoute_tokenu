import assert from "node:assert/strict";
import test from "node:test";

import { DefaultRetryPolicy } from "@/tokenu/runtime/defaultRetryPolicy";

function result(status: "succeeded" | "failed", retryability: "not-retryable" | "retryable") {
  return {
    status,
    retryability,
  } as never;
}

test("successful result never retries", () => {
  const policy = new DefaultRetryPolicy();

  assert.deepEqual(policy.evaluate(result("succeeded", "not-retryable"), 3), {
    retry: false,
    reason: "execution-succeeded",
  });
});

test("retryable failure retries when attempts remain", () => {
  const policy = new DefaultRetryPolicy();

  assert.deepEqual(policy.evaluate(result("failed", "retryable"), 2), {
    retry: true,
    reason: "retryable-failure",
  });
});

test("retryable failure stops when exhausted", () => {
  const policy = new DefaultRetryPolicy();

  assert.deepEqual(policy.evaluate(result("failed", "retryable"), 0), {
    retry: false,
    reason: "no-attempts-remaining",
  });
});
