import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionFailure } from "@/tokenu/runtime/executionResultFactory";

const target = {
  providerId: "test-provider",
  modelOfferingId: "test-model",
  upstreamModelId: "test-upstream-model",
  connectionId: "test-connection",
  credentialMode: "TOKENU_MANAGED",
  technicalProfileId: "test-profile",
  adapterId: "test-adapter",
  endpointProfileId: "test-endpoint",
  serviceRegion: null,
} as const;

test("createExecutionFailure creates a valid failed execution result", () => {
  const result = createExecutionFailure({
    requestId: "req-1",
    attemptId: "attempt-1",
    target,
    category: "unsupported",
    message: "adapter unavailable",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "unsupported");
  assert.equal(result.retryability, "unknown");
  assert.equal(result.interruption, "none");
  assert.equal(result.output, null);
  assert.equal(result.usage.totalTokens, null);
});
