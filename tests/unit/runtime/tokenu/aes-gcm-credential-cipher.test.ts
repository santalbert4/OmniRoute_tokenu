import assert from "node:assert/strict";
import test from "node:test";

import { AesGcmCredentialCipher } from "@/tokenu/adapters/security/aesGcmCredentialCipher";

const masterKey = "tokenu-test-master-key-0123456789abcdef";

const context = {
  connectionId: "groq-managed",
  providerId: "groq",
  credentialMode: "TOKENU_MANAGED" as const,
  credentialKind: "api-key" as const,
};

test("TokenU AES-GCM cipher encrypts without plaintext passthrough", () => {
  const cipher = new AesGcmCredentialCipher(masterKey);

  const plaintext = "gsk_super_secret_test_value";

  const encrypted = cipher.encrypt(plaintext, context);

  assert.match(encrypted, /^tokenu:cred:v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

  assert.equal(encrypted.includes(plaintext), false);

  assert.equal(cipher.decrypt(encrypted, context), plaintext);
});

test("TokenU AES-GCM cipher uses randomized ciphertext", () => {
  const cipher = new AesGcmCredentialCipher(masterKey);

  const first = cipher.encrypt("same-secret", context);

  const second = cipher.encrypt("same-secret", context);

  assert.notEqual(first, second);

  assert.equal(cipher.decrypt(first, context), "same-secret");

  assert.equal(cipher.decrypt(second, context), "same-secret");
});

test("TokenU AES-GCM ciphertext is bound to connection provider and credential kind", () => {
  const cipher = new AesGcmCredentialCipher(masterKey);

  const encrypted = cipher.encrypt("secret", context);

  assert.equal(
    cipher.decrypt(encrypted, {
      ...context,
      connectionId: "other-connection",
    }),
    null
  );

  assert.equal(
    cipher.decrypt(encrypted, {
      ...context,
      providerId: "other-provider",
    }),
    null
  );

  assert.equal(
    cipher.decrypt(encrypted, {
      ...context,
      credentialKind: "oauth-access-token",
    }),
    null
  );
});

test("TokenU AES-GCM cipher fails closed for wrong master key or malformed ciphertext", () => {
  const cipher = new AesGcmCredentialCipher(masterKey);

  const encrypted = cipher.encrypt("secret", context);

  const wrong = new AesGcmCredentialCipher("different-master-key-0123456789abcdef");

  assert.equal(wrong.decrypt(encrypted, context), null);

  assert.equal(cipher.decrypt("not-ciphertext", context), null);

  assert.equal(cipher.decrypt("tokenu:cred:v1:bad", context), null);
});

test("TokenU AES-GCM cipher rejects weak master keys and empty plaintext", () => {
  assert.throws(() => new AesGcmCredentialCipher("too-short"), /at least 32 characters/);

  const cipher = new AesGcmCredentialCipher(masterKey);

  assert.throws(() => cipher.encrypt(" ", context), /refuses empty plaintext/);
});
