import assert from "node:assert/strict";
import test from "node:test";

import type { RetryDecision } from "@/tokenu/contracts/retryPolicy";

test("retry decision exposes explicit retry intent", () => {
  const decision: RetryDecision = {
    retry: true,
    reason: "temporary-upstream-failure",
  };

  assert.equal(decision.retry, true);
  assert.equal(decision.reason, "temporary-upstream-failure");
});
