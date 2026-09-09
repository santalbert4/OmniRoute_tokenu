-- 177: TokenU versioned provider/model pricing catalog.
--
-- Pricing is global TokenU-owned configuration, not tenant-owned state.
-- Multiple historical price versions may exist for the same provider/model.
--
-- Logical version identity:
--   (provider_id, model_id, effective_from)
--
-- Monetary prices are persisted as integer micros:
--   1 currency unit = 1,000,000 micros.
--
-- Runtime repositories normalize effective_from/effectiveAt to canonical
-- UTC ISO timestamps before persistence and lookup. This makes lexical
-- ordering equivalent to chronological ordering.

CREATE TABLE IF NOT EXISTS tokenu_provider_pricing (
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

  input_token_price_per_million_micros INTEGER NOT NULL
    CHECK (
      typeof(input_token_price_per_million_micros) = 'integer'
      AND input_token_price_per_million_micros >= 0
    ),

  output_token_price_per_million_micros INTEGER NOT NULL
    CHECK (
      typeof(output_token_price_per_million_micros) = 'integer'
      AND output_token_price_per_million_micros >= 0
    ),

  effective_from TEXT NOT NULL
    CHECK (
      length(trim(effective_from)) > 0
    ),

  PRIMARY KEY (
    provider_id,
    model_id,
    effective_from
  )
);

CREATE INDEX IF NOT EXISTS
  idx_tokenu_provider_pricing_effective
ON tokenu_provider_pricing (
  provider_id,
  model_id,
  effective_from DESC
);
