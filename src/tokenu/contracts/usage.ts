/**
 * Provider usage normalized into TokenU's technical accounting dimensions.
 *
 * null means the upstream provider did not report or TokenU could not
 * determine the value. It must not be silently interpreted as zero.
 *
 * This is technical usage only. Billable usage and monetary amount are
 * calculated separately by the TokenU Billing Engine.
 */
export interface NormalizedUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly totalTokens: number | null;
}
