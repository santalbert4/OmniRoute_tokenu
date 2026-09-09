export interface ProviderPricing {
  readonly providerId: string;

  readonly modelId: string;

  readonly currency: string;

  /**
   * Cost per one million input tokens.
   */
  readonly inputTokenPricePerMillion: number;

  /**
   * Cost per one million output tokens.
   */
  readonly outputTokenPricePerMillion: number;

  /**
   * Optional differentiated price per one million cache-read tokens.
   *
   * Undefined/null means this historical pricing version has no separately
   * configured cache-read price.
   */
  readonly cacheReadTokenPricePerMillion?: number | null;

  /**
   * Optional differentiated price per one million cache-write tokens.
   *
   * Undefined/null means this historical pricing version has no separately
   * configured cache-write price.
   */
  readonly cacheWriteTokenPricePerMillion?: number | null;

  /**
   * When this pricing became active.
   */
  readonly effectiveFrom: string;
}
