import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import type { TechnicalModelProfileRegistry } from "@/tokenu/runtime/technicalModelProfileRegistry";

/**
 * Immutable allow-listed registry of reviewed technical model profiles.
 *
 * Missing profile ids fail closed. No profile is inferred from provider or
 * upstream model names.
 */
export class StaticTechnicalModelProfileRegistry implements TechnicalModelProfileRegistry {
  private readonly profiles: ReadonlyMap<string, TechnicalModelProfile>;

  constructor(profiles: readonly TechnicalModelProfile[]) {
    const entries = new Map<string, TechnicalModelProfile>();

    for (const profile of profiles) {
      if (profile.id.trim().length === 0) {
        throw new Error("TokenU technical model profile requires identity");
      }

      if (entries.has(profile.id)) {
        throw new Error(`TokenU technical model profile already registered: ${profile.id}`);
      }

      entries.set(profile.id, profile);
    }

    this.profiles = entries;
  }

  resolve(technicalProfileId: string): TechnicalModelProfile | null {
    return this.profiles.get(technicalProfileId) ?? null;
  }
}
