-- 174: TokenU workspace plan catalog and active workspace plan assignment.
--
-- Plans are TokenU-owned catalog definitions keyed by plan id.
-- Workspace assignments represent the currently active plan for a tenant.
--
-- Monetary limits are persisted as integer micros rather than SQLite REAL:
--   1 currency unit = 1,000,000 micros.
--
-- OmniRoute does not globally enable PRAGMA foreign_keys, so relational
-- integrity is enforced explicitly with triggers.

CREATE TABLE IF NOT EXISTS tokenu_workspace_plans (
  id TEXT PRIMARY KEY
    CHECK (length(trim(id)) > 0),

  tier TEXT NOT NULL
    CHECK (
      tier IN (
        'free',
        'starter',
        'pro',
        'enterprise'
      )
    ),

  monthly_cost_limit_micros INTEGER NOT NULL
    CHECK (monthly_cost_limit_micros >= 0),

  monthly_request_limit INTEGER NOT NULL
    CHECK (monthly_request_limit >= 0),

  currency TEXT NOT NULL
    CHECK (length(trim(currency)) > 0)
);

CREATE TABLE IF NOT EXISTS tokenu_workspace_plan_assignments (
  workspace_id TEXT PRIMARY KEY
    CHECK (length(trim(workspace_id)) > 0),

  plan_id TEXT NOT NULL
    CHECK (length(trim(plan_id)) > 0),

  assigned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokenu_workspace_plan_assignments_plan
  ON tokenu_workspace_plan_assignments(plan_id);

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_plan_assignment_workspace_insert_guard
BEFORE INSERT ON tokenu_workspace_plan_assignments
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_plan_assignment_workspace_update_guard
BEFORE UPDATE OF workspace_id ON tokenu_workspace_plan_assignments
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspaces
  WHERE id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_plan_assignment_plan_insert_guard
BEFORE INSERT ON tokenu_workspace_plan_assignments
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspace_plans
  WHERE id = NEW.plan_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_plan_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_plan_assignment_plan_update_guard
BEFORE UPDATE OF plan_id ON tokenu_workspace_plan_assignments
WHEN NOT EXISTS (
  SELECT 1
  FROM tokenu_workspace_plans
  WHERE id = NEW.plan_id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_plan_not_found');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_plan_delete_guard
BEFORE DELETE ON tokenu_workspace_plans
WHEN EXISTS (
  SELECT 1
  FROM tokenu_workspace_plan_assignments
  WHERE plan_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_plan_has_assignments');
END;

CREATE TRIGGER IF NOT EXISTS tokenu_workspace_plan_assignment_workspace_delete_guard
BEFORE DELETE ON tokenu_workspaces
WHEN EXISTS (
  SELECT 1
  FROM tokenu_workspace_plan_assignments
  WHERE workspace_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'tokenu_workspace_has_plan_assignment');
END;
