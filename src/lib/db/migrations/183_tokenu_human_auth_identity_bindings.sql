-- TokenU human authentication identity bindings.
--
-- Authentication providers remain outside TokenU core. This table stores only
-- one stable opaque external identity namespace + subject and its immutable
-- association with a TokenU-owned user.
--
-- Email, display names, passwords, sessions, access tokens and refresh tokens
-- are deliberately not authentication identity here.
--
-- OmniRoute does not globally guarantee PRAGMA foreign_keys, so referential
-- and immutability guarantees are enforced explicitly with triggers.

CREATE TABLE IF NOT EXISTS tokenu_human_identity_bindings (
  authority TEXT NOT NULL
    CHECK (length(trim(authority)) > 0),

  subject TEXT NOT NULL
    CHECK (length(trim(subject)) > 0),

  user_id TEXT NOT NULL
    CHECK (length(trim(user_id)) > 0),

  created_at TEXT NOT NULL
    CHECK (length(trim(created_at)) > 0),

  PRIMARY KEY (authority, subject)
);

CREATE INDEX IF NOT EXISTS idx_tokenu_human_identity_bindings_user
  ON tokenu_human_identity_bindings(user_id, authority, subject);

CREATE TRIGGER IF NOT EXISTS tokenu_human_identity_binding_user_insert_guard
BEFORE INSERT ON tokenu_human_identity_bindings
WHEN length(trim(NEW.user_id)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM tokenu_users
    WHERE id = NEW.user_id
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_not_found');
END;

-- A binding is immutable. Retargeting an external identity to another TokenU
-- user, changing its external identity, or rewriting its creation identity
-- metadata requires explicit removal/re-provisioning in a later control-plane
-- workflow rather than silent mutation.
CREATE TRIGGER IF NOT EXISTS tokenu_human_identity_binding_update_guard
BEFORE UPDATE ON tokenu_human_identity_bindings
BEGIN
  SELECT RAISE(ABORT, 'tokenu_human_identity_binding_immutable');
END;

-- Prevent removal of a TokenU user while an authentication identity still
-- resolves to that user.
CREATE TRIGGER IF NOT EXISTS tokenu_human_identity_binding_user_delete_guard
BEFORE DELETE ON tokenu_users
WHEN EXISTS (
  SELECT 1
  FROM tokenu_human_identity_bindings
  WHERE user_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_has_human_identity_bindings');
END;

-- Protect the same relationship if a TokenU user id is ever changed directly
-- at the SQLite layer.
CREATE TRIGGER IF NOT EXISTS tokenu_human_identity_binding_user_update_guard
BEFORE UPDATE OF id ON tokenu_users
WHEN NEW.id <> OLD.id
  AND EXISTS (
    SELECT 1
    FROM tokenu_human_identity_bindings
    WHERE user_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_has_human_identity_bindings');
END;
