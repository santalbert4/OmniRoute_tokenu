import type {
  EndpointProfile,
  EndpointProfileRegistry,
} from "@/tokenu/runtime/endpointProfileRegistry";

/**
 * Immutable allow-listed endpoint registry.
 *
 * Endpoint ids and URLs must be configured by trusted TokenU runtime code.
 * Execution requests cannot add or override endpoint profiles.
 */
export class StaticEndpointProfileRegistry implements EndpointProfileRegistry {
  private readonly profiles: ReadonlyMap<string, EndpointProfile>;

  constructor(profiles: readonly EndpointProfile[]) {
    const entries = new Map<string, EndpointProfile>();

    for (const profile of profiles) {
      if (profile.id.trim().length === 0) {
        throw new Error("TokenU endpoint profile requires identity");
      }

      if (profile.url.trim().length === 0) {
        throw new Error("TokenU endpoint profile requires URL");
      }

      if (entries.has(profile.id)) {
        throw new Error(`TokenU endpoint profile already registered: ${profile.id}`);
      }

      entries.set(profile.id, profile);
    }

    this.profiles = entries;
  }

  resolve(endpointProfileId: string): EndpointProfile | null {
    return this.profiles.get(endpointProfileId) ?? null;
  }
}
