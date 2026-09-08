export type CredentialMode =
  "TOKENU_MANAGED" | "HOSTED_BYOK" | "CUSTOMER_SIDE_BYOK" | "OAUTH_DELEGATED" | "NOT_ALLOWED";

export type ApprovedCredentialMode = Exclude<CredentialMode, "NOT_ALLOWED">;

export type CommercialApprovalStatus = "production-approved" | "experimental" | "blocked";

export type OfferingAvailability = "available" | "degraded" | "unavailable" | "unknown";

export interface TextTokenPricing {
  readonly currency: "USD";
  readonly unit: "per-million-tokens";
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
}

/**
 * One exact provider-specific way of executing a model.
 *
 * Provider identity is explicit. It must never be inferred from the
 * upstream model identifier.
 */
export interface ModelOffering {
  /**
   * Stable TokenU identifier, for example:
   * "groq:openai/gpt-oss-20b".
   */
  readonly id: string;

  /**
   * Stable TokenU provider identifier.
   */
  readonly providerId: string;

  /**
   * Optional TokenU canonical model identity shared by equivalent
   * offerings across providers.
   */
  readonly canonicalModelId: string | null;

  /**
   * Exact identifier sent to the upstream provider.
   */
  readonly upstreamModelId: string;

  /**
   * Reference to the reviewed technical behavior for this offering.
   */
  readonly technicalProfileId: string;

  /**
   * Credential custody modes approved for this provider/model offering.
   */
  readonly credentialModes: readonly ApprovedCredentialMode[];

  /**
   * Commercial approval is an eligibility veto, not a TokenScore weight.
   */
  readonly commercialStatus: CommercialApprovalStatus;

  /**
   * Current runtime/catalog availability. "unknown" fails closed when
   * availability is required for execution.
   */
  readonly availability: OfferingAvailability;

  /**
   * Regions where TokenU may offer this upstream route.
   *
   * These are explicit TokenU registry values, not inferred from the
   * provider endpoint or client IP.
   */
  readonly serviceRegions: readonly string[];

  /**
   * Current normalized catalog price used for planning.
   *
   * Billing must snapshot the applicable price at execution time instead
   * of depending on this mutable catalog value afterwards.
   */
  readonly pricing: TextTokenPricing | null;
}
