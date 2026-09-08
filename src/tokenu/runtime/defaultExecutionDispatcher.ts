import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type {
  TokenUExecutionDispatcher,
  ExecutionDispatchResult,
} from "@/tokenu/runtime/executionDispatcher";
import type { TokenUAdapterFactoryRegistry } from "@/tokenu/runtime/adapterRegistry";
import type { ExecutionDependencyResolver } from "@/tokenu/runtime/executionDependencyResolver";

export interface DefaultExecutionDispatcherOptions {
  readonly adapterRegistry: TokenUAdapterFactoryRegistry;
  readonly dependencyResolver: ExecutionDependencyResolver;
}

export class DefaultExecutionDispatcher implements TokenUExecutionDispatcher {
  private readonly adapterRegistry: TokenUAdapterFactoryRegistry;
  private readonly dependencyResolver: ExecutionDependencyResolver;

  constructor(options: DefaultExecutionDispatcherOptions) {
    this.adapterRegistry = options.adapterRegistry;
    this.dependencyResolver = options.dependencyResolver;
  }

  async execute(request: CoreExecutionRequest): Promise<ExecutionDispatchResult> {
    const factory = this.adapterRegistry.resolve(request.target.adapterId);

    if (!factory) {
      return {
        ok: false,
        error: {
          code: "adapter-not-found",
          message: "Adapter factory not registered.",
        },
      };
    }

    const endpoint = await this.dependencyResolver.resolveEndpoint(request.target);

    if (!endpoint) {
      return {
        ok: false,
        error: {
          code: "endpoint-not-found",
          message: "Endpoint not resolved.",
        },
      };
    }

    const credential = await this.dependencyResolver.resolveCredential(request.target);

    if (!credential) {
      return {
        ok: false,
        error: {
          code: "credential-not-found",
          message: "Credential not resolved.",
        },
      };
    }

    const technicalModelProfile = await this.dependencyResolver.resolveTechnicalModelProfile(
      request.target
    );

    if (!technicalModelProfile) {
      return {
        ok: false,
        error: {
          code: "technical-profile-not-found",
          message: "Technical model profile not resolved.",
        },
      };
    }

    const bindingResult = factory.bind({
      target: request.target,
      endpoint,
      credential,
      technicalModelProfile,
    });

    if (!bindingResult.ok) {
      return {
        ok: false,
        error: {
          code: "adapter-binding-failed",
          message: bindingResult.error.message,
        },
      };
    }

    if (request.stream) {
      return {
        ok: true,
        result: await bindingResult.adapter.execute(request, {
          outputSink: {
            emit: () => undefined,
          },
        }),
      };
    }

    return {
      ok: true,
      result: await bindingResult.adapter.execute(request),
    };
  }
}
