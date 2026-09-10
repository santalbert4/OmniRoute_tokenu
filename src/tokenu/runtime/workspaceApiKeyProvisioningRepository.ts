import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";

export interface ProvisionWorkspaceApiKeyInput {
  readonly workspaceId: string;

  readonly apiKey: TokenUApiKey;

  readonly assignedAt: string;
}

/**
 * Persistence boundary for one TokenU API-key credential and its authoritative
 * workspace principal binding.
 *
 * Implementations must commit both records atomically or persist neither.
 */
export interface WorkspaceApiKeyProvisioningRepository {
  provision(input: ProvisionWorkspaceApiKeyInput): Promise<void>;
}
