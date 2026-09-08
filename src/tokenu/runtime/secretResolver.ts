/**
 * Credential material resolved just in time for one approved execution path.
 *
 * CoreExecutionRequest contains only connectionId and never carries secret values.
 * New credential shapes must be added explicitly; there is intentionally no generic
 * custom/providerSpecificData escape hatch.
 */
export type ResolvedCredential =
  | {
      readonly kind: "api-key";
      readonly value: string;
    }
  | {
      readonly kind: "oauth-access-token";
      readonly value: string;
    };

/**
 * Trusted runtime boundary for resolving credential material by connection.
 * Missing or unsupported credentials fail closed by resolving to null.
 */
export interface SecretResolver {
  resolve(connectionId: string): Promise<ResolvedCredential | null>;
}
