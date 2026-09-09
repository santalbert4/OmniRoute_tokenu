CREATE TABLE IF NOT EXISTS tokenu_cost_ledger (
  workspace_id TEXT NOT NULL
    CHECK (
      length(trim(workspace_id)) > 0
    ),

  request_id TEXT NOT NULL
    CHECK (
      length(trim(request_id)) > 0
    ),

  attempt_id TEXT NOT NULL
    CHECK (
      length(trim(attempt_id)) > 0
    ),

  provider_id TEXT NOT NULL
    CHECK (
      length(trim(provider_id)) > 0
    ),

  model_id TEXT NOT NULL
    CHECK (
      length(trim(model_id)) > 0
    ),

  currency TEXT NOT NULL
    CHECK (
      length(trim(currency)) > 0
    ),

  input_tokens INTEGER NOT NULL
    CHECK (
      typeof(input_tokens) = 'integer'
      AND input_tokens >= 0
    ),

  output_tokens INTEGER NOT NULL
    CHECK (
      typeof(output_tokens) = 'integer'
      AND output_tokens >= 0
    ),

  total_tokens INTEGER NOT NULL
    CHECK (
      typeof(total_tokens) = 'integer'
      AND total_tokens >= 0
    ),

  cost_micros INTEGER NOT NULL
    CHECK (
      typeof(cost_micros) = 'integer'
      AND cost_micros >= 0
    ),

  created_at TEXT NOT NULL
    CHECK (
      length(trim(created_at)) > 0
    ),

  PRIMARY KEY (
    workspace_id,
    attempt_id
  )
);

CREATE INDEX IF NOT EXISTS
  idx_tokenu_cost_ledger_workspace_created_at
ON tokenu_cost_ledger (
  workspace_id,
  created_at
);

CREATE TRIGGER IF NOT EXISTS
  tokenu_cost_ledger_workspace_insert_guard
BEFORE INSERT ON tokenu_cost_ledger
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(
    ABORT,
    'tokenu_workspace_not_found'
  );
END;

CREATE TRIGGER IF NOT EXISTS
  tokenu_cost_ledger_workspace_update_guard
BEFORE UPDATE OF workspace_id
ON tokenu_cost_ledger
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(
    ABORT,
    'tokenu_workspace_not_found'
  );
END;

CREATE TRIGGER IF NOT EXISTS
  tokenu_workspace_cost_ledger_delete_guard
BEFORE DELETE ON tokenu_workspaces
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM tokenu_cost_ledger
  WHERE workspace_id = OLD.id
)
BEGIN
  SELECT RAISE(
    ABORT,
    'tokenu_workspace_has_cost_ledger'
  );
END;
