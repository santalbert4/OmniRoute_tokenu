# TokenU / OmniRoute — Runtime & Disaster Recovery Baseline

Status: validated PoC runtime baseline
Date: 2026-09-06
Scope: `tokenu.pro` / OmniRoute Core v3.8.51

> This document contains no credentials, API keys, passwords, encryption keys, or recoverable secret values.

## 1. Purpose

This document records the runtime state required to reproduce or recover the validated TokenU OmniRoute PoC deployed at `tokenu.pro`.

It complements `POC_BASELINE.md`.

The production database and active runtime secrets are intentionally NOT stored in Git.

## 2. Production runtime

- Domain: `tokenu.pro`
- Runtime: Node.js 24
- Next.js runtime process title: `omniroute (v16.3.3)`
- Hosting: Hostinger / LiteSpeed Node.js runtime
- Application processes observed: 2
- Both runtime processes use the same active secrets

Observed runtime working directory:

`/home/<hostinger-user>/domains/tokenu.pro/hbuilds/versions/<hostinger-build-id>/nodejs`

The Hostinger build ID is deployment-specific and must not be treated as a stable application identifier.

## 3. Data directory

No explicit `DATA_DIR` was present in the production process environment.

Observed production data directory:

`/home/<hostinger-user>/domains/tokenu.pro/.omniroute`

Primary database:

`/home/<hostinger-user>/domains/tokenu.pro/.omniroute/storage.sqlite`

## 4. SQLite state

- Journal mode: `WAL`
- `PRAGMA integrity_check;` returned `ok`

Because WAL mode is active, do not back up a running installation with a simple copy of `storage.sqlite` alone.

Validated backup method: `sqlite3 storage.sqlite ".backup <destination>"`

## 5. Validated PoC data inventory

The validated runtime backup contained:

- `provider_connections`: 2
- `provider_nodes`: 0
- `combos`: 2
- `api_keys`: 1
- persisted secrets in `key_value`: 2

The two configured provider connections correspond to the validated Gemini and Groq PoC connections.

The two combos correspond to the custom routing and fallback tests created during PoC validation.

## 6. Provider credential encryption

Provider credentials stored in `provider_connections` were verified to use OmniRoute field-level encryption.

- Gemini credential: `enc:v1`
- Groq credential: `enc:v1`
- Encryption implementation: AES-256-GCM

`STORAGE_ENCRYPTION_KEY` was present in both production processes.

The same encryption key is required to decrypt provider credentials after restoring the database.

The key must never be committed to Git or stored in this documentation.

## 7. Client API key storage finding

OmniRoute currently persists client API keys in three forms:

- `key`: full recoverable API key
- `key_prefix`: prefix
- `key_hash`: SHA-256 hash

Creation and regeneration both persist the complete raw key.

Authentication already calculates SHA-256 from the client-supplied key and supports lookup by `key_hash`.

For the future TokenU commercial layer, public customer API keys must be shown once and stored only as hash + prefix + metadata.

The commercial TokenU authentication layer should remain separate from the OmniRoute legacy key model.

## 8. OmniRoute API key generator finding

Current format: `sk-{machineId}-{keyId}-{crc8}`

The direct random component is generated with `crypto.randomBytes(3)`, providing 24 bits of direct random entropy to `keyId`.

`machineId` is derived from machine identity and a salt.

`crc8` is derived from `API_KEY_SECRET` and is not independent random entropy.

This format is acceptable for the current internal PoC/core context but must not become the TokenU commercial public API-key format.

## 9. Machine identity

On Linux, OmniRoute attempts to derive machine identity from:

- `/etc/machine-id`
- `/var/lib/dbus/machine-id`
- hostname fallbacks

It then derives a stable identifier using SHA-256 over the raw machine identity plus `MACHINE_ID_SALT`, and truncates the result to 16 hexadecimal characters.

Production observation: `MACHINE_ID_SALT` was missing from the running process environment.

A `.env` file in the Hostinger build contained a `MACHINE_ID_SALT` entry, but that variable was not present in the running process environment.

Therefore the build `.env` must not be treated as an authoritative representation of the effective runtime environment.

## 10. Persisted application secrets

OmniRoute persists generated application secrets in SQLite under the `key_value` table with namespace `secrets`.

Observed persisted keys:

- `apiKeySecret`
- `jwtSecret`

Production verification found both persisted values in a recoverable, non-`enc:v1` format.

Therefore `storage.sqlite` itself must be treated as sensitive material.

## 11. Runtime secret drift

The production process environment contained the following active secret variables:

- `STORAGE_ENCRYPTION_KEY`
- `API_KEY_SECRET`
- `JWT_SECRET`
- `OMNIROUTE_WS_BRIDGE_SECRET`

Both observed OmniRoute processes used the same active values.

However, the active runtime `API_KEY_SECRET` and `JWT_SECRET` did not match the values persisted in SQLite.

This is a confirmed runtime/database secret drift condition.

Consequences:

- `storage.sqlite` alone does not reproduce the exact current production runtime
- active runtime secrets must be preserved separately
- persisted SQLite secrets must not be assumed to be authoritative
- future TokenU production should define one explicit source of truth for secrets

No secret rotation was performed during this audit.

## 12. Hostinger runtime injection

The active OmniRoute processes run under Hostinger LiteSpeed / LSNode.

Runtime inspection showed LSAPI / LSNODE environment variables together with the active OmniRoute secret variables.

The active `STORAGE_ENCRYPTION_KEY`, `API_KEY_SECRET` and `JWT_SECRET` values were not populated from the inspected build `.env`.

They are therefore treated as external runtime configuration supplied by the hosting/deployment layer.

## 13. Validated database backup

A SQLite-consistent backup was created with SQLite `.backup`.

Backup file: `tokenu-runtime-20260906T233633Z.sqlite`

- Size: 4,005,888 bytes
- Integrity check: `ok`
- SHA-256: `e8ce9ba9ab2a189088ccca3a9124ec7ff696082ed87d750ef47aa3639fa37bdf`

The off-server downloaded copy was verified to have the same size and SHA-256 as the Hostinger copy.

The database backup is not stored in Git.

## 14. Validated encrypted runtime-secret backup

Active runtime secrets were exported directly from the process environment into an encrypted file without first writing a plaintext secrets file.

Backup file: `tokenu-runtime-secrets-20260906.enc`

Protected runtime values:

- `STORAGE_ENCRYPTION_KEY`
- `API_KEY_SECRET`
- `JWT_SECRET`
- `OMNIROUTE_WS_BRIDGE_SECRET`

Encryption parameters:

- AES-256-CBC
- PBKDF2
- 200000 iterations
- SHA-256
- salt enabled

Validation confirmed 4 encrypted runtime secrets.

- File size: 336 bytes
- Hostinger permissions: `600`
- SHA-256: `200a39ff67aa0502439ba0cd7bd2cb9333c4159b79db14285ec9cfe345c78366`

The off-server copy was verified to match the Hostinger SHA-256.

The encryption password is stored separately by the operator and must never be committed to Git.

The encrypted secrets backup itself is also not stored in Git.

## 15. Minimum recovery set

A recovery of the validated PoC currently requires:

1. compatible `OmniRoute_tokenu` source/build
2. validated SQLite backup
3. encrypted active runtime-secret backup
4. password required to decrypt the runtime-secret backup
5. compatible Node/runtime environment

In particular, `storage.sqlite` plus the matching `STORAGE_ENCRYPTION_KEY` are required to recover the encrypted provider credentials.

## 16. Recovery principles

A future restore procedure should:

1. deploy the validated TokenU OmniRoute core version
2. stop or isolate the new runtime before replacing database state
3. restore the SQLite-consistent database snapshot
4. supply the active runtime secrets from the encrypted recovery backup
5. ensure restrictive file permissions
6. start OmniRoute
7. verify database integrity
8. verify provider credential decryption
9. verify `/v1/models`
10. verify direct provider routing
11. verify custom combo routing
12. verify cross-provider fallback
13. rotate temporary/test client API credentials when appropriate

Do not treat the stale SQLite-persisted `apiKeySecret` and `jwtSecret` as authoritative runtime values.

## 17. Production hardening items

Before TokenU becomes a commercial production service:

- separate TokenU customer authentication from OmniRoute internal keys
- use high-entropy `tu_...` customer API secrets
- store only hash + prefix + metadata for customer API keys
- eliminate recoverable public client API keys
- define one authoritative source of truth for runtime secrets
- eliminate runtime/database secret drift
- fail closed when critical secret persistence is unavailable
- require `STORAGE_ENCRYPTION_KEY` in production
- fail closed if sensitive credential encryption is unavailable
- avoid recoverable structural secrets in SQLite where possible
- automate SQLite-consistent backups
- maintain encrypted off-host recovery backups
- perform and document a full restore test
- separate client requests from internal upstream attempts for accounting
- suppress raw model reasoning fields from customer responses by default

These items belong to the future TokenU production architecture and should not be implemented blindly inside the current OmniRoute PoC core.

## 18. Current status

- Runtime discovery: validated
- SQLite integrity: validated
- WAL behavior: validated
- Provider credential encryption: validated
- Client API key storage behavior: audited
- API key generator behavior: audited
- Runtime secret source: audited
- Runtime/database secret drift: confirmed
- SQLite-consistent database backup: validated
- Off-host database copy: validated by SHA-256
- Encrypted active-secret backup: validated
- Off-host encrypted secret copy: validated by SHA-256
- Full restore test: NOT YET PERFORMED

The PoC is recoverable in principle, but commercial production hardening remains required before TokenU should rely on this runtime as a customer-facing multi-tenant platform.
