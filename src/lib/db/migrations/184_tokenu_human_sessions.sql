-- 184: TokenU revocable server-side human authentication sessions.
--
-- Human sessions authenticate only an internal TokenU user. Workspace identity,
-- membership and authorization remain separate control-plane concerns.
--
-- Raw bearer secrets are never persisted. Only the SHA-256 hash of a generated
-- 256-bit secret is stored.
--
-- OmniRoute does not globally guarantee PRAGMA foreign_keys, so TokenU user
-- references and session immutability are enforced explicitly with triggers.

CREATE TABLE IF NOT EXISTS tokenu_human_sessions (
  id TEXT PRIMARY KEY
    CHECK (length(trim(id)) > 0),

  user_id TEXT NOT NULL
    CHECK (length(trim(user_id)) > 0),

  secret_hash TEXT NOT NULL
    CHECK (
      length(secret_hash) = 64
      AND secret_hash NOT GLOB '*[^0-9a-f]*'
    ),

  created_at TEXT NOT NULL
    CHECK (length(trim(created_at)) > 0),

  expires_at TEXT NOT NULL
    CHECK (length(trim(expires_at)) > 0),

  revoked_at TEXT
    CHECK (
      revoked_at IS NULL
      OR length(trim(revoked_at)) > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_tokenu_human_sessions_user_expiry
  ON tokenu_human_sessions(user_id, expires_at);

CREATE TRIGGER IF NOT EXISTS tokenu_human_session_user_insert_guard
BEFORE INSERT ON tokenu_human_sessions
WHEN length(trim(NEW.user_id)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM tokenu_users
    WHERE id = NEW.user_id
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_not_found');
END;

-- Session identity, principal, secret material and lifetime are immutable.
-- Revocation is the only supported update.
CREATE TRIGGER IF NOT EXISTS tokenu_human_session_identity_update_guard
BEFORE UPDATE OF id, user_id, secret_hash, created_at, expires_at
ON tokenu_human_sessions
WHEN NEW.id <> OLD.id
  OR NEW.user_id <> OLD.user_id
  OR NEW.secret_hash <> OLD.secret_hash
  OR NEW.created_at <> OLD.created_at
  OR NEW.expires_at <> OLD.expires_at
BEGIN
  SELECT RAISE(ABORT, 'tokenu_human_session_immutable');
END;

-- Revocation is monotonic. Once present it cannot be removed or rewritten.
CREATE TRIGGER IF NOT EXISTS tokenu_human_session_revocation_update_guard
BEFORE UPDATE OF revoked_at
ON tokenu_human_sessions
WHEN OLD.revoked_at IS NOT NULL
  AND NEW.revoked_at IS NOT OLD.revoked_at
BEGIN
  SELECT RAISE(ABORT, 'tokenu_human_session_revocation_immutable');
END;

-- A TokenU user cannot disappear while a persisted human session still
-- authenticates to that user.
CREATE TRIGGER IF NOT EXISTS tokenu_human_session_user_delete_guard
BEFORE DELETE ON tokenu_users
WHEN EXISTS (
  SELECT 1
  FROM tokenu_human_sessions
  WHERE user_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_has_human_sessions');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_human_session_user_update_guard
BEFORE UPDATE OF id ON tokenu_users
WHEN NEW.id <> OLD.id
  AND EXISTS (
    SELECT 1
    FROM tokenu_human_sessions
    WHERE user_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_has_human_sessions');
END;
