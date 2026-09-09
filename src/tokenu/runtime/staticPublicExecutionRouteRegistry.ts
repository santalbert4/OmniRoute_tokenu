import type { ModelOffering } from "@/tokenu/contracts/offering";
import type {
  ApprovedExecutionRoute,
  PublicExecutionRouteRegistry,
} from "@/tokenu/runtime/publicExecutionRouteRegistry";

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`TokenU execution route requires ${label}`);
  }
}

function assertExecutableOffering(offering: ModelOffering): void {
  assertNonEmpty(offering.id, "offering identity");
  assertNonEmpty(offering.providerId, "provider identity");
  assertNonEmpty(offering.upstreamModelId, "upstream model identity");
  assertNonEmpty(offering.technicalProfileId, "technical profile identity");

  if (offering.commercialStatus !== "production-approved") {
    throw new Error(`TokenU execution route requires production-approved offering: ${offering.id}`);
  }

  if (offering.availability !== "available") {
    throw new Error(`TokenU execution route requires available offering: ${offering.id}`);
  }
}

function assertRoute(route: ApprovedExecutionRoute): void {
  assertNonEmpty(route.publicModelId, "public model identity");
  assertNonEmpty(route.connectionId, "connection identity");
  assertNonEmpty(route.adapterId, "adapter identity");
  assertNonEmpty(route.endpointProfileId, "endpoint profile identity");

  assertExecutableOffering(route.offering);

  if (!route.offering.credentialModes.includes(route.credentialMode)) {
    throw new Error(
      `Credential mode ${route.credentialMode} is not approved for offering ${route.offering.id}`
    );
  }

  if (
    route.serviceRegion !== null &&
    !route.offering.serviceRegions.includes(route.serviceRegion)
  ) {
    throw new Error(
      `Service region ${route.serviceRegion} is not approved for offering ${route.offering.id}`
    );
  }
}

/**
 * Immutable reviewed public-model routing table.
 *
 * Resolution is exact:
 * - no provider inference
 * - no model-name parsing
 * - no alias guessing
 * - no hidden fallback
 */
export class StaticPublicExecutionRouteRegistry implements PublicExecutionRouteRegistry {
  private readonly routes: ReadonlyMap<string, ApprovedExecutionRoute>;

  constructor(routes: readonly ApprovedExecutionRoute[]) {
    const entries = new Map<string, ApprovedExecutionRoute>();

    for (const route of routes) {
      assertRoute(route);

      if (entries.has(route.publicModelId)) {
        throw new Error(`Duplicate TokenU public model identity: ${route.publicModelId}`);
      }

      entries.set(route.publicModelId, route);
    }

    this.routes = entries;
  }

  resolve(publicModelId: string): ApprovedExecutionRoute | null {
    return this.routes.get(publicModelId) ?? null;
  }
}
