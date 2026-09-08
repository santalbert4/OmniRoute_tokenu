export interface ExecutionCost {
  readonly providerId: string;

  readonly modelId: string;

  readonly currency: string;

  readonly inputCost: number;

  readonly outputCost: number;

  readonly totalCost: number;
}
