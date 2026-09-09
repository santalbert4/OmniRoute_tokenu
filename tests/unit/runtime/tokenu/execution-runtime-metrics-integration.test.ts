import assert from "node:assert/strict";
import test from "node:test";

import { DefaultExecutionPlanRunner } from "@/tokenu/runtime/defaultExecutionPlanRunner";
import { ExecutionMetricsCollector } from "@/tokenu/runtime/executionMetricsCollector";
import { InMemoryExecutionMetricSink } from "@/tokenu/runtime/inMemoryExecutionMetricSink";

test("execution runtime produces metrics from completed attempts", async () => {
  const metricSink = new InMemoryExecutionMetricSink();

  const collector = new ExecutionMetricsCollector(metricSink);

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute(request) {
        return {
          ok: true,
          result: {
            requestId: request.requestId,
            attemptId: request.attemptId,
            target: request.target,
            status: "succeeded",
          } as never,
        };
      },
    },

    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "completed",
        };
      },
    },

    eventSink: {
      async emit(event) {
        await collector.consume(event);
      },
    },
  });

  const result = await runner.execute(
    {
      requestId: "request-1",
      attempts: [
        {
          sequence: 1,
          target: {
            providerId: "groq",
            modelOfferingId: "groq:test-offering",
            upstreamModelId: "llama-test",
            connectionId: "groq-test-connection",
            credentialMode: "TOKENU_MANAGED",
            technicalProfileId: "groq-test-profile",
            adapterId: "groq-openai",
            endpointProfileId: "default",
            serviceRegion: null,
          },
        },
      ],
    },
    {
      create(context) {
        return {
          requestId: context.requestId,
          attemptId: context.attemptId,
          target: context.target,
        } as never;
      },
    }
  );

  assert.equal(result.status, "completed");

  const metrics = metricSink.getMetrics();

  assert.equal(metrics.length, 1);

  assert.equal(metrics[0]?.attemptId, "request-1-1");

  assert.equal(metrics[0]?.providerId, "groq");

  assert.equal(metrics[0]?.modelId, "llama-test");

  assert.equal(metrics[0]?.status, "succeeded");

  assert.ok((metrics[0]?.durationMs ?? 0) >= 0);
});
