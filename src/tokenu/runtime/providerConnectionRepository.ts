import type { TokenUProviderConnection } from "@/tokenu/contracts/providerConnection";

export interface ProviderConnectionRepository {
  get(connectionId: string): Promise<TokenUProviderConnection | null>;

  save(connection: TokenUProviderConnection): Promise<void>;
}
