CREATE TABLE IF NOT EXISTS tokenu_provider_connections (
  id TEXT PRIMARY KEY
    CHECK (
      length(trim(id)) > 0
    ),

  provider_id TEXT NOT NULL
    CHECK (
      length(trim(provider_id)) > 0
    ),

  credential_mode TEXT NOT NULL
    CHECK (
      credential_mode = 'TOKENU_MANAGED'
    ),

  credential_kind TEXT NOT NULL
    CHECK (
      credential_kind IN (
        'api-key',
        'oauth-access-token'
      )
    ),

  encrypted_credential TEXT NOT NULL
    CHECK (
      length(trim(encrypted_credential)) > 0
      AND encrypted_credential LIKE 'tokenu:cred:v1:%'
    ),

  enabled INTEGER NOT NULL
    CHECK (
      typeof(enabled) = 'integer'
      AND enabled IN (0, 1)
    ),

  created_at TEXT NOT NULL
    CHECK (
      length(trim(created_at)) > 0
    ),

  updated_at TEXT NOT NULL
    CHECK (
      length(trim(updated_at)) > 0
    )
);

CREATE INDEX IF NOT EXISTS
  idx_tokenu_provider_connections_provider
ON tokenu_provider_connections (
  provider_id,
  enabled
);
