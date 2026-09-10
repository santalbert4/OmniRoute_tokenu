import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const SOURCE = "src/tokenu/contracts/humanAuthenticationIdentity.ts";

function interfaceFields(source: string, interfaceName: string): string[] {
  const match = source.match(new RegExp(`export interface ${interfaceName}\\s*\\{([\\s\\S]*?)\\}`));

  assert.ok(match, `missing interface ${interfaceName}`);

  return Array.from(match[1].matchAll(/readonly\s+([A-Za-z0-9_]+)\s*:/g), (field) => field[1]);
}

test("human authentication contracts keep external identity authn and workspace authz separate", () => {
  const source = fs.readFileSync(SOURCE, "utf8");

  assert.deepEqual(interfaceFields(source, "ExternalHumanIdentity"), ["authority", "subject"]);

  assert.deepEqual(interfaceFields(source, "AuthenticatedTokenUUser"), ["userId"]);

  assert.deepEqual(interfaceFields(source, "HumanIdentityBinding"), [
    "authority",
    "subject",
    "userId",
    "createdAt",
  ]);
});
