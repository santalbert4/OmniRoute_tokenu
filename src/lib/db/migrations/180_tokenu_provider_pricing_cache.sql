-- 180: TokenU cache-aware provider pricing.
--
-- Existing historical pricing rows remain valid with NULL cache prices.
--
-- NULL means that no independently billable cache price is configured for
-- that historical version. If runtime usage reports cache tokens for a
-- dimension whose price is unknown, authoritative cost calculation must
-- fail closed instead of assuming zero or normal input price.

ALTER TABLE tokenu_provider_pricing
ADD COLUMN cache_read_token_price_per_million_micros INTEGER
  CHECK (
    cache_read_token_price_per_million_micros IS NULL
    OR (
      typeof(
        cache_read_token_price_per_million_micros
      ) = 'integer'
      AND
      cache_read_token_price_per_million_micros >= 0
    )
  );

ALTER TABLE tokenu_provider_pricing
ADD COLUMN cache_write_token_price_per_million_micros INTEGER
  CHECK (
    cache_write_token_price_per_million_micros IS NULL
    OR (
      typeof(
        cache_write_token_price_per_million_micros
      ) = 'integer'
      AND
      cache_write_token_price_per_million_micros >= 0
    )
  );
