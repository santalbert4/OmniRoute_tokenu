import assert from "node:assert/strict";
import test from "node:test";

import {
  formatHumanSessionCredential,
  generateHumanSessionSecret,
  hashHumanSessionSecret,
  isHumanSessionSecretHash,
  parseHumanSessionCredential,
  TOKENU_HUMAN_SESSION_PREFIX,
  TOKENU_HUMAN_SESSION_SECRET_BYTES,
  verifyHumanSessionSecret,
} from "@/tokenu/runtime/humanSessionMaterial";

test("human session material generates a 256-bit base64url secret", () => {
  const secret = generateHumanSessionSecret();

  assert.equal(TOKENU_HUMAN_SESSION_SECRET_BYTES, 32);
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
});

test("human session credential round-trips exact id and secret", () => {
  const secret = "A".repeat(43);
  const credential = formatHumanSessionCredential("session-a", secret);

  assert.equal(credential, `${TOKENU_HUMAN_SESSION_PREFIX}session-a.${secret}`);

  assert.deepEqual(parseHumanSessionCredential(credential), {
    sessionId: "session-a",
    secret,
  });
});

test("human session parser rejects malformed bearer credentials", () => {
  for (const credential of [
    "",
    "session-a.secret",
    "tks_",
    "tks_session-a",
    "tks_session-a.short",
    `tks_session a.${"A".repeat(43)}`,
    `tks_session-a.${"A".repeat(43)}.extra`,
  ]) {
    assert.equal(parseHumanSessionCredential(credential), null);
  }
});

test("human session persistence material contains only a SHA-256 secret hash", () => {
  const secret = "B".repeat(43);
  const hash = hashHumanSessionSecret(secret);

  assert.equal(hash.length, 64);
  assert.equal(isHumanSessionSecretHash(hash), true);
  assert.equal(hash.includes(secret), false);
  assert.equal(verifyHumanSessionSecret(secret, hash), true);
  assert.equal(verifyHumanSessionSecret("C".repeat(43), hash), false);
});
