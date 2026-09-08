import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionRunResult } from "@/tokenu/contracts/executionRunResult";

test("execution run result distinguishes completed execution", () => {
  const value: ExecutionRunResult = {
    status: "completed",
    result: {} as never,
  };

  assert.equal(value.status, "completed");
});

test("execution run result distinguishes dispatch failure", () => {
  const value: ExecutionRunResult = {
    status: "dispatch-failed",
    error: {
      code: "adapter-not-found",
      message: "Adapter unavailable.",
    },
  };

  assert.equal(value.status, "dispatch-failed");
  assert.equal(value.error.code, "adapter-not-found");
});
