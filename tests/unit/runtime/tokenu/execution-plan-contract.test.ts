import assert from "node:assert/strict";
import test from "node:test";

import type { TokenUExecutionPlan } from "@/tokenu/contracts/executionPlan";

test("execution plan preserves ordered attempts", () => {
  const plan: TokenUExecutionPlan = {
    requestId: "request-1",
    attempts: [
      {
        sequence: 1,
        target: {
          providerId: "groq",
          adapterId: "groq-official-openai-v1",
          upstreamModelId: "llama-test",
          endpointProfileId: "groq-default",
        },
      },
    ],
  };

  assert.equal(plan.attempts.length, 1);
  assert.equal(plan.attempts[0]?.sequence, 1);
});
