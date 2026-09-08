import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";

/**
 * Boundary for TokenU execution telemetry.
 *
 * Runtime components emit events without knowing
 * where events are persisted or consumed.
 */
export interface ExecutionEventSink {
  emit(event: ExecutionEvent): Promise<void>;
}
