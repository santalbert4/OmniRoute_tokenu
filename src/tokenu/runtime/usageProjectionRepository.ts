import type { UsageProjectionAttempt } from "@/tokenu/contracts/usageProjectionAttempt";

/**
 * Persistent idempotent projection boundary.
 *
 * Returns true when the attempt was projected for the first time.
 * Returns false for an identical redelivery.
 * Conflicting reuse of the same workspace + attempt identity must fail closed.
 */
export interface UsageProjectionRepository {
  projectAttempt(attempt: UsageProjectionAttempt): Promise<boolean>;
}
