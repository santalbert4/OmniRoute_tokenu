import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import type { CredentialCipher, CredentialCipherContext } from "@/tokenu/runtime/credentialCipher";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "tokenu:cred:v1:";
const KDF_SALT = "tokenu-credential-encryption-v1";

function contextAad(context: CredentialCipherContext): Buffer {
  return Buffer.from(
    JSON.stringify([
      "tokenu-credential-v1",
      context.connectionId,
      context.providerId,
      context.credentialMode,
      context.credentialKind,
    ]),
    "utf8"
  );
}

function assertContext(context: CredentialCipherContext): void {
  if (!context.connectionId.trim()) {
    throw new Error("TokenU credential cipher requires connection identity");
  }

  if (!context.providerId.trim()) {
    throw new Error("TokenU credential cipher requires provider identity");
  }
}

/**
 * TokenU-owned AES-256-GCM credential encryption.
 *
 * Security properties:
 * - master key is injected; this class never reads process.env
 * - no plaintext passthrough exists
 * - random 96-bit IV per encryption
 * - full 128-bit GCM authentication tag
 * - authenticated metadata binds ciphertext to connection/provider/kind
 */
export class AesGcmCredentialCipher implements CredentialCipher {
  private readonly key: Buffer;

  constructor(masterKey: string) {
    if (typeof masterKey !== "string" || masterKey.trim().length < 32) {
      throw new Error("TokenU credential master key must contain at least 32 characters");
    }

    this.key = scryptSync(masterKey, KDF_SALT, KEY_LENGTH);
  }

  encrypt(plaintext: string, context: CredentialCipherContext): string {
    assertContext(context);

    if (!plaintext.trim()) {
      throw new Error("TokenU credential cipher refuses empty plaintext");
    }

    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    cipher.setAAD(contextAad(context));

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return (
      `${PREFIX}${iv.toString("hex")}:` + `${encrypted.toString("hex")}:` + authTag.toString("hex")
    );
  }

  decrypt(ciphertext: string, context: CredentialCipherContext): string | null {
    assertContext(context);

    if (typeof ciphertext !== "string" || !ciphertext.startsWith(PREFIX)) {
      return null;
    }

    const encoded = ciphertext.slice(PREFIX.length);

    const parts = encoded.split(":");

    if (parts.length !== 3) {
      return null;
    }

    const [ivHex, encryptedHex, authTagHex] = parts;

    try {
      const iv = Buffer.from(ivHex, "hex");
      const encrypted = Buffer.from(encryptedHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
        return null;
      }

      const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      decipher.setAAD(contextAad(context));
      decipher.setAuthTag(authTag);

      const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        "utf8"
      );

      return plaintext.trim() ? plaintext : null;
    } catch {
      return null;
    }
  }
}
