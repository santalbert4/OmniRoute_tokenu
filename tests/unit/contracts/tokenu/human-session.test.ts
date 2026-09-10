import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const SOURCE = "src/tokenu/contracts/humanSession.ts";

function interfaceFields(source: string, name: string): string[] {
  const match = source.match(new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\}`));

  assert.ok(match, `missing interface ${name}`);

  return Array.from(match[1].matchAll(/readonly\s+(\w+)\s*:/g), (field) => field[1]);
}

test("human session contracts expose only authentication session state", () => {
  const source = fs.readFileSync(SOURCE, "utf8");

  assert.deepEqual(interfaceFields(source, "TokenUHumanSession"), [
    "id",
    "userId",
    "secretHash",
    "createdAt",
    "expiresAt",
    "revokedAt",
  ]);

  assert.deepEqual(interfaceFields(source, "CreatedHumanSession"), ["session", "credential"]);

  for (const forbidden of [
    "workspaceId",
    "requestedWorkspaceId",
    "role",
    "authority",
    "subject",
    "email",
    "password",
    "accessToken",
    "refreshToken",
  ]) {
    assert.equal(interfaceFields(source, "TokenUHumanSession").includes(forbidden), false);
  }
});
