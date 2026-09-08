export interface ExecutionMetric {
  readonly requestId: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly providerId: string;
  readonly adapterId: string;
  readonly modelId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly status: "succeeded" | "failed";
}
