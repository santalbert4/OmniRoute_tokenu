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
   * When this pricing became active.
   */
  readonly effectiveFrom: string;
}
