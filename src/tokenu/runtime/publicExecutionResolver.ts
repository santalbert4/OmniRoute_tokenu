import type { TokenUExecutionPlan } from "@/tokenu/contracts/executionPlan";
import type {
  ApprovedExecutionRoute,
  PublicExecutionRouteRegistry,
} from "@/tokenu/runtime/publicExecutionRouteRegistry";

export interface PublicExecutionSelection {
  /**
   * Server-created request identity.
   */
  readonly requestId: string;

  /**
   * Stable public TokenU model id supplied by the client.
   */
  readonly publicModelId: string;
}

function toExecutionPlan(requestId: string, route: ApprovedExecutionRoute): TokenUExecutionPlan {
  return {
    requestId,
    attempts: [
      {
        sequence: 1,
        target: {
          providerId: route.offering.providerId,
          modelOfferingId: route.offering.id,
          upstreamModelId: route.offering.upstreamModelId,
          connectionId: route.connectionId,
          credentialMode: route.credentialMode,
          technicalProfileId: route.offering.technicalProfileId,
          adapterId: route.adapterId,
          endpointProfileId: route.endpointProfileId,
          serviceRegion: route.serviceRegion,
        },
      },
    ],
  };
}

/**
 * Converts the deliberately narrow public model selection into an immutable
 * technical execution plan.
 *
 * The public caller cannot supply provider, connection, endpoint, credential,
 * adapter or technical profile identity through this boundary.
 */
export class PublicExecutionResolver {
  constructor(private readonly routeRegistry: PublicExecutionRouteRegistry) {}

  resolve(selection: PublicExecutionSelection): TokenUExecutionPlan | null {
    if (!selection.requestId.trim()) {
      throw new Error("TokenU public execution requires request identity");
    }

    if (!selection.publicModelId.trim()) {
      return null;
    }

    const route = this.routeRegistry.resolve(selection.publicModelId);

    if (!route) {
      return null;
    }

    return toExecutionPlan(selection.requestId, route);
  }
}
