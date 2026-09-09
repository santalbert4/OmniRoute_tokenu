import assert from "node:assert/strict";
import test from "node:test";

import {
  generateTokenUApiKey,
  getTokenUApiKeyDisplayPrefix,
  hashTokenUApiKey,
  isTokenUApiKey,
} from "@/tokenu/runtime/tokenUApiKeyMaterial";

test("TokenU API-key generator creates 256-bit product-owned bearer tokens", () => {
  const first = generateTokenUApiKey();
  const second = generateTokenUApiKey();

  assert.match(first, /^tku_[A-Za-z0-9_-]{43}$/);
  assert.match(second, /^tku_[A-Za-z0-9_-]{43}$/);

  assert.notEqual(first, second);

  assert.equal(isTokenUApiKey(first), true);
  assert.equal(isTokenUApiKey(second), true);
});

test("TokenU API-key hash is deterministic lowercase SHA-256", () => {
  const token = "tku_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  const first = hashTokenUApiKey(token);
  const second = hashTokenUApiKey(token);

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, token);
});

test("TokenU API-key material rejects non-TokenU bearer formats", () => {
  for (const invalid of [
    "",
    "legacy-secret",
    "sk_test_abc",
    "tku_short",
    " tku_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "tku_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA ",
  ]) {
    assert.equal(isTokenUApiKey(invalid), false);

    assert.throws(() => hashTokenUApiKey(invalid), /Invalid TokenU API key format/);
  }
});

test("TokenU API-key display prefix reveals only a small non-secret identifier", () => {
  const token = "tku_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  const prefix = getTokenUApiKeyDisplayPrefix(token);

  assert.equal(prefix, "tku_AAAAAAAA");
  assert.equal(token.startsWith(prefix), true);
  assert.equal(prefix.length, 12);
  assert.equal(prefix.length < token.length, true);
});
