import type { TechnicalModelProfile } from "@/tokenu/contracts/model";

/**
 * Fail-closed runtime registry for reviewed technical model profiles.
 *
 * ExecutionTarget carries only technicalProfileId. Missing profiles must fail
 * during pre-dispatch and must not be inferred from provider or model names.
 */
export interface TechnicalModelProfileRegistry {
  resolve(technicalProfileId: string): TechnicalModelProfile | null;
}
