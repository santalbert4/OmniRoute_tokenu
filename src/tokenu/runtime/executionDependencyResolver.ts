import type { EndpointProfile } from "@/tokenu/runtime/endpointProfileRegistry";
import type { ResolvedCredential } from "@/tokenu/runtime/secretResolver";
import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";

/**
 * Resolves trusted runtime dependencies required before adapter binding.
 *
 * This layer owns infrastructure lookup only.
 * It must not select providers, models or fallback targets.
 */
export interface ExecutionDependencyResolver {
  resolveEndpoint(target: ExecutionTarget): Promise<EndpointProfile | null>;

  resolveCredential(target: ExecutionTarget): Promise<ResolvedCredential | null>;

  resolveTechnicalModelProfile(target: ExecutionTarget): Promise<TechnicalModelProfile | null>;
}
