import type {
  NonStreamingCoreExecutionRequest,
  StreamingCoreExecutionRequest,
} from "@/tokenu/contracts/coreExecutionRequest";
import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { JsonValue } from "@/tokenu/contracts/json";

/**
 * Receives translated client-visible streaming output from one upstream attempt.
 *
 * Backpressure may be implemented by returning a Promise from emit().
 */
export interface CoreExecutionOutputSink {
  emit(item: JsonValue): void | Promise<void>;
}

/**
 * Runtime-only execution controls.
 *
 * These controls are deliberately separate from CoreExecutionRequest because
 * they are process/runtime concerns rather than serializable routing data.
 */
export interface BaseSingleTargetExecutionControl {
  /**
   * Optional cancellation signal owned by the caller.
   */
  readonly signal?: AbortSignal;
}

export interface StreamingSingleTargetExecutionControl extends BaseSingleTargetExecutionControl {
  readonly outputSink: CoreExecutionOutputSink;
}

export interface NonStreamingSingleTargetExecutionControl extends BaseSingleTargetExecutionControl {
  readonly outputSink?: never;
}

/**
 * Trusted technical boundary between TokenU orchestration and one approved
 * provider execution path.
 *
 * Each execute() invocation performs exactly one upstream attempt against the
 * already-resolved ExecutionTarget in the request.
 *
 * The adapter must not:
 * - select another provider or model
 * - perform retries
 * - run TokenScore or commercial policy
 * - accept arbitrary upstream endpoints
 * - expose provider credentials
 */
export interface SingleTargetAdapter {
  readonly id: string;

  execute(
    request: StreamingCoreExecutionRequest,
    control: StreamingSingleTargetExecutionControl
  ): Promise<CoreExecutionResult>;

  execute(
    request: NonStreamingCoreExecutionRequest,
    control?: NonStreamingSingleTargetExecutionControl
  ): Promise<CoreExecutionResult>;
}
