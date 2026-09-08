import type { ApprovedCredentialMode } from "@/tokenu/contracts/offering";

/**
 * One fully resolved and commercially approved upstream execution target.
 *
 * An ExecutionTarget is produced by TokenU routing/policy layers and consumed
 * by the SingleTargetAdapter. It represents exactly one upstream attempt.
 */
export interface ExecutionTarget {
  /**
   * Stable TokenU provider identifier.
   */
  readonly providerId: string;

  /**
   * Exact approved ModelOffering selected for this attempt.
   */
  readonly modelOfferingId: string;

  /**
   * Exact model identifier sent to the upstream provider.
   */
  readonly upstreamModelId: string;

  /**
   * Exact provider connection whose credential will be resolved just in time
   * by the trusted secret layer.
   */
  readonly connectionId: string;

  /**
   * Credential custody mode already approved for this connection/offering.
   */
  readonly credentialMode: ApprovedCredentialMode;

  /**
   * Reviewed TechnicalModelProfile used for translation and capability facts.
   */
  readonly technicalProfileId: string;

  /**
   * Explicit approved executor/adapter implementation.
   *
   * This identifier must resolve through a fail-closed TokenU adapter registry.
   */
  readonly adapterId: string;

  /**
   * Explicit immutable upstream endpoint profile.
   *
   * Clients cannot provide or override this value.
   */
  readonly endpointProfileId: string;

  /**
   * Concrete service region selected for this attempt when applicable.
   */
  readonly serviceRegion: string | null;
}
