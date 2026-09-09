-- 181: TokenU-owned API-key credential identities.
--
-- Raw bearer tokens are never persisted. Authentication lookup is performed
-- using the deterministic SHA-256 hash of high-entropy TokenU-generated keys.
-- Workspace ownership remains separate in tokenu_workspace_principals.

CREATE TABLE IF NOT EXISTS tokenu_api_keys (
  id TEXT PRIMARY KEY
    CHECK (length(trim(id)) > 0),

  name TEXT NOT NULL
    CHECK (length(trim(name)) > 0),

  key_prefix TEXT NOT NULL
    CHECK (length(trim(key_prefix)) > 0),

  key_hash TEXT NOT NULL UNIQUE
    CHECK (
      length(key_hash) = 64
      AND key_hash = lower(key_hash)
      AND key_hash NOT GLOB '*[^0-9a-f]*'
    ),

  created_at TEXT NOT NULL
    CHECK (julianday(created_at) IS NOT NULL),

  expires_at TEXT
    CHECK (
      expires_at IS NULL
      OR julianday(expires_at) IS NOT NULL
    ),

  revoked_at TEXT
    CHECK (
      revoked_at IS NULL
      OR julianday(revoked_at) IS NOT NULL
    ),

  last_used_at TEXT
    CHECK (
      last_used_at IS NULL
      OR julianday(last_used_at) IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_tokenu_api_keys_prefix
  ON tokenu_api_keys (key_prefix);
