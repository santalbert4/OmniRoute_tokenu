import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import type { ExecutionDependencyResolver } from "@/tokenu/runtime/executionDependencyResolver";
import type {
  EndpointProfile,
  EndpointProfileRegistry,
} from "@/tokenu/runtime/endpointProfileRegistry";
import type { ResolvedCredential, SecretResolver } from "@/tokenu/runtime/secretResolver";
import type { TechnicalModelProfileRegistry } from "@/tokenu/runtime/technicalModelProfileRegistry";

export interface DefaultExecutionDependencyResolverOptions {
  readonly endpointProfileRegistry: EndpointProfileRegistry;
  readonly secretResolver: SecretResolver;
  readonly technicalModelProfileRegistry: TechnicalModelProfileRegistry;
}

/**
 * Resolves the exact dependencies declared by one immutable ExecutionTarget.
 *
 * This resolver performs lookup only:
 * - no provider inference
 * - no model inference
 * - no endpoint discovery
 * - no credential rotation
 * - no fallback selection
 */
export class DefaultExecutionDependencyResolver implements ExecutionDependencyResolver {
  constructor(private readonly options: DefaultExecutionDependencyResolverOptions) {}

  async resolveEndpoint(target: ExecutionTarget): Promise<EndpointProfile | null> {
    return this.options.endpointProfileRegistry.resolve(target.endpointProfileId);
  }

  async resolveCredential(target: ExecutionTarget): Promise<ResolvedCredential | null> {
    return this.options.secretResolver.resolve(target.connectionId);
  }

  async resolveTechnicalModelProfile(
    target: ExecutionTarget
  ): Promise<TechnicalModelProfile | null> {
    return this.options.technicalModelProfileRegistry.resolve(target.technicalProfileId);
  }
}
