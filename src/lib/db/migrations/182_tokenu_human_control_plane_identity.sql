-- 182: TokenU human control-plane identity and workspace membership.
--
-- Human control-plane identity is intentionally separate from
-- tokenu_workspace_principals, which remains the data-plane API-key ->
-- workspace binding.
--
-- Authentication mechanism is deliberately absent here. TokenU's internal
-- user and membership identities must not be owned by an OAuth/session vendor.
--
-- OmniRoute does not globally guarantee PRAGMA foreign_keys, so membership
-- references and owner invariants are enforced explicitly with triggers.

CREATE TABLE IF NOT EXISTS tokenu_users (
  id TEXT PRIMARY KEY
    CHECK (length(trim(id)) > 0),

  created_at TEXT NOT NULL
    CHECK (length(trim(created_at)) > 0)
);

CREATE TABLE IF NOT EXISTS tokenu_workspace_memberships (
  workspace_id TEXT NOT NULL
    CHECK (length(trim(workspace_id)) > 0),

  user_id TEXT NOT NULL
    CHECK (length(trim(user_id)) > 0),

  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'member')),

  created_at TEXT NOT NULL
    CHECK (length(trim(created_at)) > 0),

  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tokenu_workspace_memberships_user
  ON tokenu_workspace_memberships(user_id, workspace_id);

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_membership_workspace_insert_guard
BEFORE INSERT ON tokenu_workspace_memberships
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_membership_user_insert_guard
BEFORE INSERT ON tokenu_workspace_memberships
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_not_found');
END;

-- Once a workspace has human memberships, it must always have an owner.
-- Therefore the first membership must be an owner.
CREATE TRIGGER IF NOT EXISTS tokenu_workspace_membership_initial_owner_guard
BEFORE INSERT ON tokenu_workspace_memberships
WHEN NEW.role <> 'owner'
  AND NOT EXISTS (
    SELECT 1
    FROM tokenu_workspace_memberships
    WHERE workspace_id = NEW.workspace_id
      AND role = 'owner'
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_requires_owner');
END;

-- Membership identity is the workspace + user relation. Moving a row to a
-- different workspace/user would be identity retargeting; remove/create is
-- required instead.
CREATE TRIGGER IF NOT EXISTS tokenu_workspace_membership_identity_update_guard
BEFORE UPDATE OF workspace_id, user_id ON tokenu_workspace_memberships
WHEN NEW.workspace_id <> OLD.workspace_id
  OR NEW.user_id <> OLD.user_id
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_membership_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_membership_last_owner_delete_guard
BEFORE DELETE ON tokenu_workspace_memberships
WHEN OLD.role = 'owner'
  AND NOT EXISTS (
    SELECT 1
    FROM tokenu_workspace_memberships
    WHERE workspace_id = OLD.workspace_id
      AND role = 'owner'
      AND user_id <> OLD.user_id
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_requires_owner');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_membership_last_owner_role_guard
BEFORE UPDATE OF role ON tokenu_workspace_memberships
WHEN OLD.role = 'owner'
  AND NEW.role <> 'owner'
  AND NOT EXISTS (
    SELECT 1
    FROM tokenu_workspace_memberships
    WHERE workspace_id = OLD.workspace_id
      AND role = 'owner'
      AND user_id <> OLD.user_id
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_requires_owner');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_membership_workspace_delete_guard
BEFORE DELETE ON tokenu_workspaces
WHEN EXISTS (
  SELECT 1
  FROM tokenu_workspace_memberships
  WHERE workspace_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_has_memberships');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_user_delete_guard
BEFORE DELETE ON tokenu_users
WHEN EXISTS (
  SELECT 1
  FROM tokenu_workspace_memberships
  WHERE user_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_user_has_memberships');
END;
