/**
 * Provider usage normalized into TokenU's technical accounting dimensions.
 *
 * null means the upstream provider did not report or TokenU could not
 * determine the value. It must not be silently interpreted as zero.
 *
 * This is technical usage only. Billable usage and monetary amount are
 * calculated separately by the TokenU Billing Engine.
 *
 * Normalization invariant:
 * - inputTokens is the total input/prompt token count when known.
 * - cacheReadTokens and cacheWriteTokens are subsets of inputTokens when known.
 * - null means unknown and must not be silently interpreted as zero by
 *   authoritative billing when a differentiated cache price applies.
 */
export interface NormalizedUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly totalTokens: number | null;
}
