/**
 * Immutable upstream endpoint profile resolved by TokenU runtime.
 *
 * Clients and execution requests must never provide or override endpoint data.
 */
export interface EndpointProfile {
  readonly id: string;
  readonly url: string;
}

/**
 * Fail-closed registry for approved upstream endpoint profiles.
 */
export interface EndpointProfileRegistry {
  resolve(endpointProfileId: string): EndpointProfile | null;
}
