import { AesGcmCredentialCipher } from "@/tokenu/adapters/security/aesGcmCredentialCipher";
import { SqliteProviderConnectionRepository } from "@/tokenu/adapters/storage/sqliteProviderConnectionRepository";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import {
  GROQ_GPT_OSS_20B_PROVIDER_PRICING,
  GROQ_MANAGED_CONNECTION_ID,
  GROQ_PROVIDER_ID,
  PRODUCTION_GROQ_ENDPOINT_PROFILES,
  PRODUCTION_GROQ_PUBLIC_EXECUTION_ROUTES,
  PRODUCTION_GROQ_TECHNICAL_MODEL_PROFILES,
} from "@/tokenu/runtime/productionGroqCatalog";
import { PersistentSecretResolver } from "@/tokenu/runtime/persistentSecretResolver";
import { StaticEndpointProfileRegistry } from "@/tokenu/runtime/staticEndpointProfileRegistry";
import { StaticPublicExecutionRouteRegistry } from "@/tokenu/runtime/staticPublicExecutionRouteRegistry";
import { StaticTechnicalModelProfileRegistry } from "@/tokenu/runtime/staticTechnicalModelProfileRegistry";
import {
  createTokenURuntimeComposition,
  getTokenURuntimeComposition,
} from "@/tokenu/runtime/tokenuRuntimeComposition";

type TokenUApiRuntimeComposition = ReturnType<typeof createTokenURuntimeComposition>;

export interface TokenUProductionRuntimeOptions {
  readonly database: TokenUSqliteDatabase;
  readonly credentialMasterKey: string;
}

/**
 * Creates the production-capable TokenU runtime from trusted server inputs.
 *
 * Route activation is conditional on one exact persistent managed connection:
 * - id: groq-managed
 * - provider: groq
 * - custody: TOKENU_MANAGED
 * - kind: api-key
 * - enabled
 * - decryptable with the supplied TokenU master key
 *
 * No provider inference, credential fallback or key rotation occurs here.
 */
export async function createTokenUProductionRuntimeComposition(
  options: TokenUProductionRuntimeOptions
): Promise<TokenUApiRuntimeComposition> {
  const masterKey = options.credentialMasterKey.trim();

  if (!masterKey) {
    throw new Error("TokenU production runtime requires a credential master key");
  }

  const cipher = new AesGcmCredentialCipher(masterKey);

  const providerConnectionRepository = new SqliteProviderConnectionRepository(options.database);

  const connection = await providerConnectionRepository.get(GROQ_MANAGED_CONNECTION_ID);

  if (!connection || !connection.enabled) {
    return createTokenURuntimeComposition(options.database);
  }

  if (
    connection.providerId !== GROQ_PROVIDER_ID ||
    connection.credentialMode !== "TOKENU_MANAGED" ||
    connection.credentialKind !== "api-key"
  ) {
    throw new Error("TokenU managed Groq connection identity mismatch");
  }

  const secretResolver = new PersistentSecretResolver(providerConnectionRepository, cipher);

  const credential = await secretResolver.resolve(GROQ_MANAGED_CONNECTION_ID);

  if (!credential || credential.kind !== "api-key" || !credential.value.trim()) {
    throw new Error("TokenU managed Groq credential could not be decrypted");
  }

  // The plaintext validation value is intentionally not retained.
  // Runtime execution resolves the credential again just in time.
  const runtime = createTokenURuntimeComposition(options.database, {
    secretResolver,
    endpointProfileRegistry: new StaticEndpointProfileRegistry(PRODUCTION_GROQ_ENDPOINT_PROFILES),
    technicalModelProfileRegistry: new StaticTechnicalModelProfileRegistry(
      PRODUCTION_GROQ_TECHNICAL_MODEL_PROFILES
    ),
    publicExecutionRouteRegistry: new StaticPublicExecutionRouteRegistry(
      PRODUCTION_GROQ_PUBLIC_EXECUTION_ROUTES
    ),
  });

  await runtime.providerPricingRepository.save(GROQ_GPT_OSS_20B_PROVIDER_PRICING);

  return runtime;
}

let apiRuntimePromise: Promise<TokenUApiRuntimeComposition> | null = null;

/**
 * API/server singleton.
 *
 * Environment access intentionally lives here, outside src/tokenu.
 *
 * Missing TOKENU_CREDENTIAL_MASTER_KEY preserves the existing fail-closed
 * TokenU runtime. A configured master key enables production composition only
 * after the persistent groq-managed credential passes validation.
 */
export function getTokenUApiRuntimeComposition(): Promise<TokenUApiRuntimeComposition> {
  if (apiRuntimePromise) {
    return apiRuntimePromise;
  }

  const credentialMasterKey = process.env.TOKENU_CREDENTIAL_MASTER_KEY?.trim();

  if (!credentialMasterKey) {
    apiRuntimePromise = Promise.resolve(getTokenURuntimeComposition());

    return apiRuntimePromise;
  }

  apiRuntimePromise = createTokenUProductionRuntimeComposition({
    database: getTokenUSqliteDatabase(),
    credentialMasterKey,
  });

  return apiRuntimePromise;
}
