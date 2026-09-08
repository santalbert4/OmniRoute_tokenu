import assert from "node:assert/strict";
import test from "node:test";

import type { TokenUExecutionPlanRunner } from "@/tokenu/runtime/executionPlanRunner";

test("execution plan runner contract exposes execute method", () => {
  const runner: TokenUExecutionPlanRunner = {
    async execute() {
      return {
        status: "dispatch-failed",
        error: {
          code: "adapter-not-found",
          message: "missing",
        },
      };
    },
  };

  assert.equal(typeof runner.execute, "function");
});
