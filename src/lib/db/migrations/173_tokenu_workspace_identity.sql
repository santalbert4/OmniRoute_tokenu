-- 173: TokenU workspace identity boundary.
--
-- TokenU workspaces are SaaS tenant identities owned by TokenU.
-- They are intentionally distinct from provider-specific workspace/account
-- identifiers such as Codex/OpenAI workspaceId values.
--
-- OmniRoute does not globally enable PRAGMA foreign_keys, so workspace
-- membership integrity is enforced with triggers rather than relying on
-- SQLite foreign-key enforcement.

CREATE TABLE IF NOT EXISTS tokenu_workspaces (
  id TEXT PRIMARY KEY
    CHECK (length(trim(id)) > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokenu_workspace_principals (
  workspace_id TEXT NOT NULL
    CHECK (length(trim(workspace_id)) > 0),
  principal_type TEXT NOT NULL
    CHECK (principal_type = 'api_key'),
  principal_id TEXT NOT NULL
    CHECK (length(trim(principal_id)) > 0),
  assigned_at TEXT NOT NULL,

  PRIMARY KEY (principal_type, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_tokenu_workspace_principals_workspace
  ON tokenu_workspace_principals(workspace_id);

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_principal_workspace_insert_guard
BEFORE INSERT ON tokenu_workspace_principals
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_principal_workspace_update_guard
BEFORE UPDATE OF workspace_id ON tokenu_workspace_principals
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_delete_guard
BEFORE DELETE ON tokenu_workspaces
WHEN EXISTS (
  SELECT 1
  FROM tokenu_workspace_principals
  WHERE workspace_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_has_principals');
END;
