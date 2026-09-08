import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceCostSummaryService } from "@/tokenu/runtime/workspaceCostSummaryService";

test("workspace cost summary aggregates provider usage", () => {
  const service = new WorkspaceCostSummaryService();

  const summary = service.summarize("workspace-1", "2026-09", [
    {
      workspaceId: "workspace-1",
      period: "2026-09",
      providerId: "openai",
      modelId: "gpt-5",
      requestCount: 10,
      inputTokens: 5000,
      outputTokens: 2000,
      estimatedCost: 0.2,
    },
    {
      workspaceId: "workspace-1",
      period: "2026-09",
      providerId: "google",
      modelId: "gemini-3.7-flash",
      requestCount: 5,
      inputTokens: 3000,
      outputTokens: 1000,
      estimatedCost: 0.1,
    },
  ]);

  assert.equal(summary.totalRequests, 15);

  assert.equal(summary.totalInputTokens, 8000);

  assert.equal(summary.totalOutputTokens, 3000);

  assert.equal(summary.estimatedCost, 0.3);
});
