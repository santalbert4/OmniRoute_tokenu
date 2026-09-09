import { getTokenUSqliteDatabase } from "../../src/tokenu/adapters/storage/tokenuSqliteDatabase";
import { provisionGroqManagedCredential } from "../../src/app/api/v1/tokenu/provisionGroqManagedCredential";

async function main(): Promise<void> {
  const credentialMasterKey =
    process.env.TOKENU_CREDENTIAL_MASTER_KEY ?? "";

  const groqApiKey =
    process.env.TOKENU_GROQ_API_KEY ?? "";

  // Reduce the lifetime of plaintext secrets in the process environment.
  delete process.env.TOKENU_CREDENTIAL_MASTER_KEY;
  delete process.env.TOKENU_GROQ_API_KEY;

  if (!credentialMasterKey.trim()) {
    throw new Error(
      "TOKENU_CREDENTIAL_MASTER_KEY is required"
    );
  }

  if (!groqApiKey.trim()) {
    throw new Error(
      "TOKENU_GROQ_API_KEY is required"
    );
  }

  const result =
    await provisionGroqManagedCredential({
      database:
        getTokenUSqliteDatabase(),
      credentialMasterKey,
      groqApiKey,
    });

  console.log(
    `TokenU managed provider credential provisioned: ` +
      `${result.connectionId} (${result.providerId})`
  );
}

main().catch(() => {
  // Deliberately avoid serializing exceptions from a secret-handling process.
  console.error(
    "TokenU Groq credential provisioning failed."
  );

  process.exitCode = 1;
});
