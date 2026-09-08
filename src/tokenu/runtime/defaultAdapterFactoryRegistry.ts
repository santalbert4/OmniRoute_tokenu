import type {
  SingleTargetAdapterFactory,
  TokenUAdapterFactoryRegistry,
} from "@/tokenu/runtime/adapterRegistry";
import { GROQ_ADAPTER_ID, GroqAdapterFactory } from "@/tokenu/adapters/groq/groqAdapterFactory";

export interface DefaultAdapterFactoryRegistryOptions {
  readonly fetchImpl?: typeof fetch;
}

/**
 * Explicit allow-listed registry of TokenU execution adapter factories.
 *
 * Unknown adapter ids are rejected.
 * No provider/model inference is performed here.
 */
export class DefaultAdapterFactoryRegistry implements TokenUAdapterFactoryRegistry {
  private readonly factories: ReadonlyMap<string, SingleTargetAdapterFactory>;

  constructor(options: DefaultAdapterFactoryRegistryOptions = {}) {
    const groqFactory = new GroqAdapterFactory({
      fetchImpl: options.fetchImpl,
    });

    this.factories = new Map([[GROQ_ADAPTER_ID, groqFactory]]);
  }

  resolve(adapterId: string): SingleTargetAdapterFactory | null {
    return this.factories.get(adapterId) ?? null;
  }
}
