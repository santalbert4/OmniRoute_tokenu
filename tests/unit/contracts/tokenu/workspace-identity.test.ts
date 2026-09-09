import assert from "node:assert/strict";
import test from "node:test";

import type {
  TokenUWorkspace,
  TokenUWorkspacePrincipal,
} from "@/tokenu/contracts/workspaceIdentity";

test("TokenU workspace identity is separate from external API key identity", () => {
  const workspace: TokenUWorkspace = {
    id: "workspace-1",
    createdAt: "2026-09-09T00:00:00.000Z",
  };

  const principal: TokenUWorkspacePrincipal = {
    workspaceId: workspace.id,
    principalType: "api_key",
    principalId: "api-key-db-id-1",
    assignedAt: "2026-09-09T00:01:00.000Z",
  };

  assert.equal(principal.workspaceId, "workspace-1");

  assert.equal(principal.principalId, "api-key-db-id-1");

  assert.notEqual(principal.workspaceId, principal.principalId);
});
