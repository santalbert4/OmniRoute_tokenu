CREATE TABLE IF NOT EXISTS tokenu_usage_projection_attempts (
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

  period TEXT NOT NULL
    CHECK (
      length(trim(period)) > 0
    ),

  provider_id TEXT NOT NULL
    CHECK (
      length(trim(provider_id)) > 0
    ),

  model_id TEXT NOT NULL
    CHECK (
      length(trim(model_id)) > 0
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

  estimated_cost_micros INTEGER NOT NULL
    CHECK (
      typeof(estimated_cost_micros) = 'integer'
      AND estimated_cost_micros >= 0
    ),

  recorded_at TEXT NOT NULL
    CHECK (
      length(trim(recorded_at)) > 0
    ),

  PRIMARY KEY (
    workspace_id,
    attempt_id
  )
);

CREATE INDEX IF NOT EXISTS
  idx_tokenu_usage_projection_workspace_period
ON tokenu_usage_projection_attempts (
  workspace_id,
  period
);

CREATE TRIGGER IF NOT EXISTS
  tokenu_usage_projection_workspace_insert_guard
BEFORE INSERT ON tokenu_usage_projection_attempts
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
  tokenu_usage_projection_workspace_update_guard
BEFORE UPDATE OF workspace_id
ON tokenu_usage_projection_attempts
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
  tokenu_workspace_usage_projection_delete_guard
BEFORE DELETE ON tokenu_workspaces
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM tokenu_usage_projection_attempts
  WHERE workspace_id = OLD.id
)
BEGIN
  SELECT RAISE(
    ABORT,
    'tokenu_workspace_has_usage_projection'
  );
END;
