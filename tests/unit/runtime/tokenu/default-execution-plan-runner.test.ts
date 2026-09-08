import assert from "node:assert/strict";
import test from "node:test";

import { DefaultExecutionPlanRunner } from "@/tokenu/runtime/defaultExecutionPlanRunner";

test("runner completes successful first attempt", async () => {
  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute() {
        return {
          ok: true,
          result: {
            status: "succeeded",
          } as never,
        };
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "done",
        };
      },
    },
  });

  const result = await runner.execute(
    {
      requestId: "request-1",
      attempts: [
        {
          sequence: 1,
          target: {} as never,
        },
      ],
    },
    {
      create() {
        return {} as never;
      },
    }
  );

  assert.equal(result.status, "completed");
});
