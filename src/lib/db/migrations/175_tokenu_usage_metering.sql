-- 175: TokenU persistent usage counters and metering.
--
-- These tables persist three deliberately separate concepts:
--
--   tokenu_workspace_request_usage
--     Authoritative monthly request counter used for plan quota enforcement.
--
--   tokenu_workspace_usage_metering
--     Analytical execution/token metering for the workspace.
--
--   tokenu_provider_usage
--     Analytical usage aggregated by provider and model.
--
-- Counters are designed to be updated atomically with SQLite UPSERTs.
--
-- Monetary estimates are persisted as integer micros:
--   1 currency unit = 1,000,000 micros.
--
-- OmniRoute does not globally enable PRAGMA foreign_keys, so workspace
-- integrity is enforced with triggers.

CREATE TABLE IF NOT EXISTS tokenu_workspace_request_usage (
  workspace_id TEXT NOT NULL
    CHECK (length(trim(workspace_id)) > 0),

  period TEXT NOT NULL
    CHECK (length(trim(period)) > 0),

  request_count INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(request_count) = 'integer'
      AND request_count >= 0
    ),

  PRIMARY KEY (
    workspace_id,
    period
  )
);

CREATE TABLE IF NOT EXISTS tokenu_workspace_usage_metering (
  workspace_id TEXT NOT NULL
    CHECK (length(trim(workspace_id)) > 0),

  period TEXT NOT NULL
    CHECK (length(trim(period)) > 0),

  metered_execution_count INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(metered_execution_count) = 'integer'
      AND metered_execution_count >= 0
    ),

  input_tokens INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(input_tokens) = 'integer'
      AND input_tokens >= 0
    ),

  output_tokens INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(output_tokens) = 'integer'
      AND output_tokens >= 0
    ),

  estimated_cost_micros INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(estimated_cost_micros) = 'integer'
      AND estimated_cost_micros >= 0
    ),

  PRIMARY KEY (
    workspace_id,
    period
  )
);

CREATE TABLE IF NOT EXISTS tokenu_provider_usage (
  workspace_id TEXT NOT NULL
    CHECK (length(trim(workspace_id)) > 0),

  period TEXT NOT NULL
    CHECK (length(trim(period)) > 0),

  provider_id TEXT NOT NULL
    CHECK (length(trim(provider_id)) > 0),

  model_id TEXT NOT NULL
    CHECK (length(trim(model_id)) > 0),

  request_count INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(request_count) = 'integer'
      AND request_count >= 0
    ),

  input_tokens INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(input_tokens) = 'integer'
      AND input_tokens >= 0
    ),

  output_tokens INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(output_tokens) = 'integer'
      AND output_tokens >= 0
    ),

  estimated_cost_micros INTEGER NOT NULL DEFAULT 0
    CHECK (
      typeof(estimated_cost_micros) = 'integer'
      AND estimated_cost_micros >= 0
    ),

  PRIMARY KEY (
    workspace_id,
    period,
    provider_id,
    model_id
  )
);

CREATE TRIGGER IF NOT EXISTS tokenu_request_usage_workspace_insert_guard
BEFORE INSERT ON tokenu_workspace_request_usage
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_request_usage_workspace_update_guard
BEFORE UPDATE OF workspace_id ON tokenu_workspace_request_usage
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_metering_workspace_insert_guard
BEFORE INSERT ON tokenu_workspace_usage_metering
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_metering_workspace_update_guard
BEFORE UPDATE OF workspace_id ON tokenu_workspace_usage_metering
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_provider_usage_workspace_insert_guard
BEFORE INSERT ON tokenu_provider_usage
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_provider_usage_workspace_update_guard
BEFORE UPDATE OF workspace_id ON tokenu_provider_usage
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_usage_delete_guard
BEFORE DELETE ON tokenu_workspaces
WHEN
  EXISTS (
    SELECT 1
    FROM tokenu_workspace_request_usage
    WHERE workspace_id = OLD.id
  )
  OR EXISTS (
    SELECT 1
    FROM tokenu_workspace_usage_metering
    WHERE workspace_id = OLD.id
  )
  OR EXISTS (
    SELECT 1
    FROM tokenu_provider_usage
    WHERE workspace_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_has_usage');
END;
