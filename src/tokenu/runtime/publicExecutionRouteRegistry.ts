import type { ApprovedCredentialMode, ModelOffering } from "@/tokenu/contracts/offering";

/**
 * One server-owned execution route exposed through a stable public model id.
 *
 * None of the technical execution identifiers in this contract may come from
 * the public request body.
 */
export interface ApprovedExecutionRoute {
  /**
   * Stable model identifier accepted by the TokenU public API.
   */
  readonly publicModelId: string;

  /**
   * Exact commercially approved provider-specific offering.
   */
  readonly offering: ModelOffering;

  /**
   * Exact credential custody mode approved for this execution route.
   */
  readonly credentialMode: ApprovedCredentialMode;

  /**
   * Internal TokenU provider connection.
   */
  readonly connectionId: string;

  /**
   * Explicit fail-closed execution adapter.
   */
  readonly adapterId: string;

  /**
   * Explicit immutable upstream endpoint profile.
   */
  readonly endpointProfileId: string;

  /**
   * Optional explicitly approved service region.
   */
  readonly serviceRegion: string | null;
}

/**
 * Fail-closed lookup boundary between a public model id and one fully reviewed
 * TokenU execution route.
 */
export interface PublicExecutionRouteRegistry {
  resolve(publicModelId: string): ApprovedExecutionRoute | null;
}
