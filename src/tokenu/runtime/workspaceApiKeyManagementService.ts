import type { TokenUApiKeyMetadata } from "@/tokenu/contracts/tokenUApiKeyMetadata";
import type {
  CreatedTokenUApiKey,
  TokenUApiKeyService,
} from "@/tokenu/runtime/tokenUApiKeyService";
import type { WorkspaceApiKeyProvisioningRepository } from "@/tokenu/runtime/workspaceApiKeyProvisioningRepository";
import type { WorkspacePrincipalRepository } from "@/tokenu/runtime/workspacePrincipalRepository";

export interface CreateWorkspaceApiKeyInput {
  readonly name: string;

  readonly expiresAt?: string | null;
}

export interface WorkspaceApiKeyManagementServiceOptions {
  readonly now?: () => string;
}

type ApiKeyServicePort = Pick<
  TokenUApiKeyService,
  "createWithPersistence" | "getMetadata" | "revoke"
>;

type ProvisioningPort = Pick<WorkspaceApiKeyProvisioningRepository, "provision">;

type WorkspacePrincipalPort = Pick<WorkspacePrincipalRepository, "get" | "listByWorkspace">;

function requireTrustedWorkspaceId(workspaceId: string): string {
  const normalized = workspaceId.trim();

  if (!normalized) {
    throw new Error("TokenU API-key management requires trusted workspace identity");
  }

  return normalized;
}

/**
 * Tenant-scoped control-plane service for TokenU API keys.
 *
 * The workspace identity is supplied by a trusted control-plane boundary.
 * It must never be selected from public API-key-management request payloads.
 */
export class WorkspaceApiKeyManagementService {
  private readonly now: () => string;

  constructor(
    private readonly apiKeyService: ApiKeyServicePort,
    private readonly provisioningRepository: ProvisioningPort,
    private readonly workspacePrincipalRepository: WorkspacePrincipalPort,
    options: WorkspaceApiKeyManagementServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async create(
    trustedWorkspaceId: string,
    input: CreateWorkspaceApiKeyInput
  ): Promise<CreatedTokenUApiKey> {
    const workspaceId = requireTrustedWorkspaceId(trustedWorkspaceId);

    const createInput =
      input.expiresAt === undefined
        ? {
            name: input.name,
          }
        : {
            name: input.name,
            expiresAt: input.expiresAt,
          };

    return this.apiKeyService.createWithPersistence(createInput, (apiKey) =>
      this.provisioningRepository.provision({
        workspaceId,
        apiKey,
        assignedAt: apiKey.createdAt,
      })
    );
  }

  async list(
    trustedWorkspaceId: string,
    evaluatedAt: string = this.now()
  ): Promise<readonly TokenUApiKeyMetadata[]> {
    const workspaceId = requireTrustedWorkspaceId(trustedWorkspaceId);

    const bindings = await this.workspacePrincipalRepository.listByWorkspace(workspaceId);

    const metadata: TokenUApiKeyMetadata[] = [];

    for (const binding of bindings) {
      const apiKey = await this.apiKeyService.getMetadata(binding.principalId, evaluatedAt);

      if (apiKey === null) {
        throw new Error("TokenU workspace principal references missing API-key credential");
      }

      metadata.push(apiKey);
    }

    return metadata;
  }

  async revoke(
    trustedWorkspaceId: string,
    apiKeyId: string,
    revokedAt: string = this.now()
  ): Promise<boolean> {
    const workspaceId = requireTrustedWorkspaceId(trustedWorkspaceId);

    const normalizedApiKeyId = apiKeyId.trim();

    if (!normalizedApiKeyId) {
      return false;
    }

    const binding = await this.workspacePrincipalRepository.get("api_key", normalizedApiKeyId);

    if (binding === null || binding.workspaceId !== workspaceId) {
      return false;
    }

    return this.apiKeyService.revoke(normalizedApiKeyId, revokedAt);
  }
}
