import type { HumanIdentityBinding } from "@/tokenu/contracts/humanAuthenticationIdentity";

/**
 * Exact lookup boundary for externally authenticated human identities.
 *
 * Binding creation/provisioning is intentionally outside this phase.
 */
export interface HumanIdentityBindingRepository {
  get(authority: string, subject: string): Promise<HumanIdentityBinding | null>;
}
