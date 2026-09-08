import type { SingleTargetAdapter } from "@/tokenu/contracts/singleTargetAdapter";

/**
 * Fail-closed registry for approved TokenU execution adapters.
 *
 * Adapter selection is already resolved by TokenU orchestration through
 * ExecutionTarget.adapterId. Missing adapters must never be inferred.
 */
export interface TokenUAdapterRegistry {
  resolve(adapterId: string): SingleTargetAdapter | null;
}
